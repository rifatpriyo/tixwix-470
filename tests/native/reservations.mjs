import EmbeddedPostgres from "embedded-postgres";
import { Client } from "pg";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const directory = resolve(".qa", `postgres-${randomUUID()}`);
mkdirSync(directory, { recursive: true });
const port = Number(process.env.TIXWIX_TEST_PG_PORT ?? 55439);
const password = randomUUID();
// pg_ctl shuts down all Windows PG18 I/O workers; the package's taskkill-based
// stop can leave inherited pipe handles open after its parent exits.
class TestPostgres extends EmbeddedPostgres {
  running = false;
  async start() {
    await super.start();
    this.running = true;
  }
  async stop() {
    if (!this.running) return;
    if (process.platform === "win32") {
      const { pg_ctl } = await import("@embedded-postgres/windows-x64");
      await promisify(execFile)(
        pg_ctl,
        ["-D", directory, "-m", "fast", "-w", "stop"],
        { windowsHide: true },
      );
    } else {
      await super.stop();
    }
    this.running = false;
  }
}
const server = new TestPostgres({
  databaseDir: directory,
  user: "postgres",
  password,
  port,
  persistent: true,
  onLog: () => {},
  onError: () => {},
});
const config = {
  host: "127.0.0.1",
  port,
  user: "postgres",
  password,
  database: "postgres",
};
let owner;
const ids = {
  host: randomUUID(),
  a: randomUUID(),
  b: randomUUID(),
  admin: randomUUID(),
};
async function as(user, sql, args = []) {
  const c = new Client(config);
  await c.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${user ? "authenticated" : "anon"}`);
    await c.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user ?? "",
    ]);
    const result = await c.query(sql, args);
    await c.query("commit");
    return result.rows;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    await c.end();
  }
}
const rpc = async (user, name, args) =>
  (
    await as(
      user,
      `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) result`,
      args,
    )
  )[0].result;
const hold = (user, session, seats = [], ga = [], key = randomUUID()) =>
  rpc(user, "create_reservation", [session, key, seats, JSON.stringify(ga)]);
let count = 0;
async function check(name, fn) {
  await fn();
  count++;
  console.log(`PASS ${name}`);
}
try {
  await server.initialise();
  await server.start();
  owner = new Client(config);
  await owner.connect();
  await owner.query(
    readFileSync("tests/support/reservation-fixture.sql", "utf8"),
  );
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await owner.query(readFileSync(`supabase/migrations/${file}`, "utf8"));
  for (const id of Object.values(ids))
    await owner.query(
      "insert into auth.users(id,email_confirmed_at) values($1,now())",
      [id],
    );
  await owner.query(
    "insert into public.user_roles(user_id,role) values($1,'admin')",
    [ids.admin],
  );
  const application = (
    await as(
      ids.host,
      "select * from public.submit_host_application('Demo host','demo@example.com','+8801712345678','We organize music and cultural events in Dhaka.')",
    )
  )[0];
  await as(
    ids.admin,
    "select public.review_host_application($1,'approved',null)",
    [application.id],
  );
  const input = {
    title: "Reservation Demo",
    description: "Small concert hall with two independent showtimes.",
    category: "concert",
    venue_name: "Demo Concert Hall",
    address: "Dhaka",
    city: "Dhaka",
    starts_at: "2099-12-20T12:00:00+06:00",
    ends_at: "2099-12-20T14:00:00+06:00",
    ticket_name: "Numbered",
    price_minor: 50000,
    capacity: 24,
  };
  const event = (
    await as(ids.host, "select * from public.save_event(null,null,$1)", [
      JSON.stringify(input),
    ])
  )[0];
  const session = (
    await owner.query(
      "select id from public.event_sessions where event_id=$1",
      [event.id],
    )
  ).rows[0].id;
  const category = (
    await owner.query(
      "select id from public.event_ticket_categories where event_id=$1",
      [event.id],
    )
  ).rows[0].id;
  await rpc(ids.host, "assign_seating", [
    event.id,
    event.version,
    category,
    4,
    6,
  ]);
  const second = (
    await owner.query(
      "insert into public.event_sessions(event_id,starts_at,ends_at) values($1,'2099-12-20T18:00:00+06:00','2099-12-20T20:00:00+06:00') returning id",
      [event.id],
    )
  ).rows[0].id;
  const ga = (
    await owner.query(
      "insert into public.event_ticket_categories(event_id,name,price_minor,capacity) values($1,'General Admission',25000,1) returning id",
      [event.id],
    )
  ).rows[0].id;
  await as(ids.host, "select public.transition_event($1,2,'submit',null)", [
    event.id,
  ]);
  await as(ids.admin, "select public.transition_event($1,3,'publish',null)", [
    event.id,
  ]);
  const seats = (
    await owner.query(
      "select id,label from public.event_seats where event_id=$1 order by row_index,seat_number",
      [event.id],
    )
  ).rows;
  const [a1, a2] = seats.map((s) => s.id);
  let winner;
  await check(
    "simultaneous same-seat requests yield exactly one winner",
    async () => {
      const results = await Promise.allSettled([
        hold(ids.a, session, [a1]),
        hold(ids.b, session, [a1]),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        results.find((r) => r.status === "rejected").reason.code,
        "PT409",
      );
      winner = results.find((r) => r.status === "fulfilled").value;
    },
  );
  await check(
    "availability reveals status without customer or booking identity",
    async () => {
      const available = await rpc(null, "session_availability", [session]);
      assert.equal(available.seats.find((s) => s.id === a1).available, false);
      assert.ok(!JSON.stringify(available).includes(winner.id));
      assert.ok(!JSON.stringify(available).includes(ids.a));
    },
  );
  await check("multi-seat conflict leaves other seat free", async () => {
    await assert.rejects(
      hold(ids.b, session, [a1, a2]),
      (e) => e.code === "PT409",
    );
    assert.equal(
      (await rpc(null, "session_availability", [session])).seats.find(
        (s) => s.id === a2,
      ).available,
      true,
    );
  });
  await check("independent showtimes", async () => {
    await hold(ids.b, second, [a1]);
  });
  await check("concurrent last general-admission ticket", async () => {
    const results = await Promise.allSettled([
      hold(ids.a, session, [], [{ category_id: ga, quantity: 1 }]),
      hold(ids.b, session, [], [{ category_id: ga, quantity: 1 }]),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      results.find((r) => r.status === "rejected").reason.code,
      "PT409",
    );
  });
  let booking;
  const key = randomUUID();
  await check(
    "same retry key concurrently returns original booking and expiry",
    async () => {
      const results = await Promise.all([
        hold(ids.a, session, [a2], [], key),
        hold(ids.a, session, [a2], [], key),
      ]);
      booking = results[0];
      assert.equal(results[0].id, results[1].id);
      assert.equal(results[0].expires_at, results[1].expires_at);
      assert.equal(booking.total_minor, 50000);
      assert.equal(
        (Date.parse(booking.expires_at) - Date.parse(booking.created_at)) /
          1000 >
          599,
        true,
      );
    },
  );
  await check("reusing key for different request is rejected", async () => {
    await assert.rejects(
      hold(ids.a, second, [a2], [], key),
      (e) => e.code === "PT409",
    );
  });
  await check(
    "ownership enforced for reads/releases and direct tables",
    async () => {
      await assert.rejects(
        rpc(ids.b, "reservation", [booking.id, false]),
        (e) => e.code === "P0002",
      );
      await assert.rejects(
        rpc(ids.b, "reservation", [booking.id, true]),
        (e) => e.code === "P0002",
      );
      assert.equal(
        (
          await as(ids.b, "select * from public.bookings where id=$1", [
            booking.id,
          ])
        ).length,
        0,
      );
      assert.equal(
        (await rpc(ids.a, "reservation", [booking.id, false])).state,
        "pending",
      );
      await assert.rejects(
        as(ids.a, "update public.bookings set state='canceled' where id=$1", [
          booking.id,
        ]),
        (e) => e.code === "42501",
      );
    },
  );
  await check(
    "cancellation releases inventory and records history",
    async () => {
      await rpc(ids.a, "reservation", [booking.id, true]);
      await hold(ids.b, session, [a2]);
      assert.deepEqual(
        (
          await owner.query(
            "select state from public.booking_history where booking_id=$1 order by created_at",
            [booking.id],
          )
        ).rows.map((r) => r.state),
        ["pending", "canceled"],
      );
    },
  );
  await check(
    "expired hold reclaimed without cleanup; retry preserves expiry",
    async () => {
      const expires = "2000-01-01T00:00:00Z";
      await owner.query(
        "update public.bookings set expires_at=$1 where id=$2",
        [expires, winner.id],
      );
      await hold(ids.a, session, [a1]);
      assert.equal(
        (
          await owner.query("select state from public.bookings where id=$1", [
            winner.id,
          ])
        ).rows[0].state,
        "expired",
      );
    },
  );
  await check(
    "capacity and schedule edits reject allocations and preserve IDs",
    async () => {
      await assert.rejects(
        owner.query(
          "update public.event_ticket_categories set capacity=1 where id=$1",
          [category],
        ),
        (e) => e.code === "PT409",
      );
      await assert.rejects(
        as(ids.host, "select public.save_event($1,4,$2)", [
          event.id,
          JSON.stringify({
            ...input,
            starts_at: "2099-12-21T12:00:00+06:00",
            ends_at: "2099-12-21T14:00:00+06:00",
          }),
        ]),
        (e) => e.code === "PT409",
      );
      assert.equal(
        (
          await owner.query(
            "select count(*)::int n from public.event_sessions where event_id=$1",
            [event.id],
          )
        ).rows[0].n,
        2,
      );
    },
  );
  await check(
    "layouts cannot replace booked records; other customers cannot assign",
    async () => {
      await assert.rejects(
        rpc(ids.host, "assign_seating", [event.id, 4, category, 3, 6]),
        (e) => e.code === "PT409",
      );
      await assert.rejects(
        rpc(ids.a, "assign_seating", [event.id, 4, category, 3, 6]),
        (e) => e.code === "42501",
      );
    },
  );
  await check("unpublished and started sessions reject new holds", async () => {
    await owner.query("update public.events set status='draft' where id=$1", [
      event.id,
    ]);
    await assert.rejects(
      hold(ids.a, session, [seats[2].id]),
      (e) => e.code === "PT409",
    );
    await owner.query(
      "update public.events set status='published' where id=$1",
      [event.id],
    );
    const past = (
      await owner.query(
        "insert into public.event_sessions(event_id,starts_at,ends_at) values($1,'2000-01-01','2000-01-02') returning id",
        [event.id],
      )
    ).rows[0].id;
    await assert.rejects(
      hold(ids.a, past, [seats[2].id]),
      (e) => e.code === "PT409",
    );
  });
  console.log(
    `${count} native PostgreSQL checks passed. Auth/Storage scaffolded; no Supabase service integration claimed.`,
  );
} finally {
  await owner?.end();
  await server.stop();
}
