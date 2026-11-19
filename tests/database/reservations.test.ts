import { PGlite, type Transaction } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
const host = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  admin = "33333333-3333-4333-8333-333333333333",
  customer = "44444444-4444-4444-8444-444444444444";
let db: PGlite;
async function asUser<T>(
  id: string | null,
  work: (tx: Transaction) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${id ? "authenticated" : "anon"}`);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      id ?? "",
    ]);
    return work(tx);
  });
}
type Record = { id: string; slug: string; status: string; version: number };
const complete = {
  title: "Dhaka Unplugged",
  description: "An evening of acoustic music in Dhaka.",
  category: "concert",
  venue_name: "Acoustic Hall",
  address: "12 Dhanmondi Road",
  city: "Dhaka",
  starts_at: "2099-12-20T00:30:00+06:00",
  ends_at: "2099-12-20T02:30:00+06:00",
  ticket_name: "General Admission",
  price_minor: 50000,
  capacity: 100,
  poster: null,
};
async function save(
  data: object,
  id: string | null = null,
  version: number | null = null,
  actor = host,
) {
  return asUser(
    actor,
    async (tx) =>
      (
        await tx.query<Record>("select * from public.save_event($1,$2,$3)", [
          id,
          version,
          data,
        ])
      ).rows[0],
  );
}
async function transition(
  e: Record,
  action: string,
  feedback: string | null = null,
  actor = action === "submit" ? host : admin,
) {
  return asUser(
    actor,
    async (tx) =>
      (
        await tx.query<Record>(
          "select * from public.transition_event($1,$2,$3,$4)",
          [e.id, e.version, action, feedback],
        )
      ).rows[0],
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant select,insert,update,delete on storage.objects to anon,authenticated;`);
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  for (const id of [host, other, admin, customer])
    await db.query(
      "insert into auth.users(id,email_confirmed_at) values($1,now())",
      [id],
    );
  await db.query(
    "insert into public.user_roles(user_id,role) values($1,'admin')",
    [admin],
  );
  for (const id of [host, other]) {
    const application = await asUser(
      id,
      async (tx) =>
        (
          await tx.query<{ id: string }>(
            "select * from public.submit_host_application('Organizer','host@example.com','+8801712345678','We organize community concerts and cultural events in Dhaka.')",
          )
        ).rows[0],
    );
    await asUser(admin, (tx) =>
      tx.query(
        "select * from public.review_host_application($1,'approved',null)",
        [application.id],
      ),
    );
  }
});
afterAll(async () => {
  await db?.close();
});
describe("reservations on embedded PostgreSQL (serial connections, scaffolded Auth/Storage)", () => {
  it("checks atomic allocation, retry recovery, ownership, expiry and session isolation", async () => {
    let e = await save(complete);
    const session = (
      await db.query<{ id: string }>(
        "select id from public.event_sessions where event_id=$1",
        [e.id],
      )
    ).rows[0].id;
    const category = (
      await db.query<{ id: string }>(
        "select id from public.event_ticket_categories where event_id=$1",
        [e.id],
      )
    ).rows[0].id;
    await asUser(host, (tx) =>
      tx.query("select public.assign_seating($1,$2,$3,2,2)", [
        e.id,
        e.version,
        category,
      ]),
    );
    e = { ...e, version: e.version + 1 };
    e = await transition(e, "submit");
    e = await transition(e, "publish");
    const seats = (
      await db.query<{ id: string }>(
        "select id from public.event_seats where event_id=$1 order by label",
        [e.id],
      )
    ).rows;
    const second = (
      await db.query<{ id: string }>(
        "insert into public.event_sessions(event_id,starts_at,ends_at) values($1,'2099-12-21','2099-12-22') returning id",
        [e.id],
      )
    ).rows[0].id;
    const ga = (
      await db.query<{ id: string }>(
        "insert into public.event_ticket_categories(event_id,name,price_minor,capacity) values($1,'GA',25000,1) returning id",
        [e.id],
      )
    ).rows[0].id;
    type Booking = {
      id: string;
      state: string;
      expires_at: string;
      total_minor: number;
    };
    const hold = async (
      actor: string,
      selected: string[],
      key = crypto.randomUUID(),
      show = session,
      admission: object[] = [],
    ) =>
      (
        await asUser(actor, (tx) =>
          tx.query<{ b: Booking }>(
            "select public.create_reservation($1,$2,$3,$4) b",
            [show, key, selected, JSON.stringify(admission)],
          ),
        )
      ).rows[0].b;
    const read = async (actor: string, id: string, release = false) =>
      (
        await asUser(actor, (tx) =>
          tx.query<{ b: Booking }>("select public.reservation($1,$2) b", [
            id,
            release,
          ]),
        )
      ).rows[0].b;
    const key = crypto.randomUUID();
    const held = await hold(customer, [seats[0].id], key);
    expect(held.total_minor).toBe(50000);
    expect(await hold(customer, [seats[0].id], key)).toMatchObject({
      id: held.id,
      expires_at: held.expires_at,
      total_minor: 50000,
    });
    await expect(hold(other, [seats[0].id, seats[1].id])).rejects.toThrow();
    const free = await hold(other, [seats[1].id]);
    expect(free.state).toBe("pending");
    await expect(read(other, held.id)).rejects.toThrow();
    await expect(read(other, held.id, true)).rejects.toThrow();
    expect(
      (
        await asUser(other, (tx) =>
          tx.query("select * from public.bookings where id=$1", [held.id]),
        )
      ).rows,
    ).toHaveLength(0);
    await hold(other, [seats[0].id], crypto.randomUUID(), second);
    await hold(customer, [], crypto.randomUUID(), session, [
      { category_id: ga, quantity: 1 },
    ]);
    await expect(
      hold(other, [], crypto.randomUUID(), session, [
        { category_id: ga, quantity: 1 },
      ]),
    ).rejects.toThrow();
    await expect(
      db.query(
        "update public.event_ticket_categories set capacity=1 where id=$1",
        [category],
      ),
    ).rejects.toThrow();
    expect((await read(customer, held.id, true)).state).toBe("canceled");
    const replacement = await hold(other, [seats[0].id]);
    await db.query(
      "update public.bookings set expires_at=clock_timestamp()-interval '1 second' where id=$1",
      [replacement.id],
    );
    await hold(customer, [seats[0].id]);
    expect((await read(other, replacement.id)).state).toBe("expired");
    expect(
      (
        await db.query<{ state: string }>(
          "select state from public.booking_history where booking_id=$1 order by created_at",
          [replacement.id],
        )
      ).rows.map((r) => r.state),
    ).toEqual(["pending", "expired"]);
  });
});
