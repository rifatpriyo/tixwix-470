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
describe("Division 2 embedded PostgreSQL (Storage schema scaffolded)", () => {
  it("runs correction, publication, combined Dhaka-day discovery, and withdrawal atomically", async () => {
    let e = await save({ title: "Dhaka Unplugged" });
    expect(e.status).toBe("draft");
    await expect(transition(e, "submit")).rejects.toThrow();
    expect(
      (
        await asUser(host, (tx) =>
          tx.query<Record>("select * from public.events where id=$1", [e.id]),
        )
      ).rows[0].status,
    ).toBe("draft");
    e = await save(complete, e.id, e.version);
    e = await transition(e, "submit");
    await expect(save(complete, e.id, e.version)).rejects.toThrow();
    await expect(transition(e, "request_changes", "   ")).rejects.toThrow();
    e = await transition(e, "request_changes", "Clarify the venue entrance.");
    e = await save(
      { ...complete, address: "12 Dhanmondi Road, north entrance" },
      e.id,
      e.version,
    );
    e = await transition(e, "submit");
    const stale = e;
    e = await transition(e, "publish");
    await expect(
      transition(stale, "request_changes", "Too late"),
    ).rejects.toThrow();
    await expect(transition(stale, "publish")).rejects.toThrow();
    const search = await asUser(null, (tx) =>
      tx.query<{ result: { events: { starting_price: number }[] } }>(
        "select public.search_events('Unplugged','concert','Dhaka','2099-12-20',1) result",
      ),
    );
    expect(
      search.rows[0].result.events.find((x) => x.starting_price === 50000),
    ).toBeTruthy();
    expect(
      (
        await asUser(null, (tx) =>
          tx.query<{ result: { events: unknown[] } }>(
            "select public.search_events('Unplugged','concert','Dhaka','2099-12-19',1) result",
          ),
        )
      ).rows[0].result.events,
    ).toHaveLength(0);
    expect(
      (
        await asUser(null, (tx) =>
          tx.query("select * from public.event_details where slug=$1", [
            e.slug,
          ]),
        )
      ).rows,
    ).toHaveLength(1);
    await expect(
      asUser(null, (tx) => tx.query("select * from public.event_reviews")),
    ).rejects.toThrow();
    e = await save(
      { ...complete, title: "Dhaka Unplugged revised" },
      e.id,
      e.version,
    );
    expect(e.status).toBe("draft");
    expect(e.slug).toBe(stale.slug);
    expect(
      (
        await asUser(null, (tx) =>
          tx.query("select * from public.event_details where slug=$1", [
            e.slug,
          ]),
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await asUser(null, (tx) =>
          tx.query("select * from public.event_sessions where event_id=$1", [
            e.id,
          ]),
        )
      ).rows,
    ).toHaveLength(0);
    const history = await asUser(host, (tx) =>
      tx.query<{ new_status: string }>(
        "select new_status from public.event_reviews where event_id=$1 order by created_at",
        [e.id],
      ),
    );
    expect(history.rows.map((r) => r.new_status)).toEqual([
      "draft",
      "pending_review",
      "changes_requested",
      "pending_review",
      "published",
      "draft",
    ]);
  });
  it("denies customers, another approved host, direct writes and fractional/invalid ticket data", async () => {
    await expect(save(complete, null, null, customer)).rejects.toThrow();
    let e = await save(complete);
    await expect(save(complete, e.id, e.version, other)).rejects.toThrow();
    await expect(transition(e, "publish", null, host)).rejects.toThrow();
    expect(
      (
        await asUser(other, (tx) =>
          tx.query("select * from public.events where id=$1", [e.id]),
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      asUser(host, (tx) =>
        tx.query("update public.events set status='published' where id=$1", [
          e.id,
        ]),
      ),
    ).rejects.toThrow();
    for (const data of [
      { price_minor: -1 },
      { price_minor: 1.5 },
      { capacity: 0 },
      { capacity: 1.5 },
      { ends_at: complete.starts_at },
    ])
      await expect(
        save({ ...complete, ...data }, e.id, e.version),
      ).rejects.toThrow();
    e = await transition(e, "submit");
    await expect(transition(e, "publish", null, other)).rejects.toThrow();
  });
  it("keeps unpublished posters private, forbids replacing published bytes, and withdraws poster access", async () => {
    let e = await save(complete);
    const path = `${host}/${e.id}/poster.png`;
    await asUser(host, (tx) =>
      tx.query(
        "insert into storage.objects(bucket_id,name) values('event-posters',$1)",
        [path],
      ),
    );
    await expect(
      asUser(other, (tx) =>
        tx.query(
          "insert into storage.objects(bucket_id,name) values('event-posters',$1)",
          [`${host}/${e.id}/evil.png`],
        ),
      ),
    ).rejects.toThrow();
    e = await save({ ...complete, poster: path }, e.id, e.version);
    expect(
      (
        await asUser(null, (tx) =>
          tx.query("select * from storage.objects where name=$1", [path]),
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await asUser(admin, (tx) =>
          tx.query("select * from storage.objects where name=$1", [path]),
        )
      ).rows,
    ).toHaveLength(1);
    e = await transition(e, "submit");
    await expect(
      asUser(host, (tx) =>
        tx.query(
          "insert into storage.objects(bucket_id,name) values('event-posters',$1)",
          [`${host}/${e.id}/new.png`],
        ),
      ),
    ).rejects.toThrow();
    e = await transition(e, "publish");
    expect(
      (
        await asUser(null, (tx) =>
          tx.query("select * from storage.objects where name=$1", [path]),
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await asUser(host, (tx) =>
          tx.query("delete from storage.objects where name=$1 returning *", [
            path,
          ]),
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await asUser(host, (tx) =>
          tx.query(
            "update storage.objects set name='changed' where name=$1 returning *",
            [path],
          ),
        )
      ).rows,
    ).toHaveLength(0);
    e = await save({ ...complete, poster: path }, e.id, e.version);
    expect(
      (
        await asUser(null, (tx) =>
          tx.query("select * from storage.objects where name=$1", [path]),
        )
      ).rows,
    ).toHaveLength(0);
  });
});
