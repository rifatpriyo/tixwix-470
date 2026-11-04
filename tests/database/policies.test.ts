import { PGlite, type Transaction } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";

// Real PostgreSQL engine (WASM). Only Supabase's auth schema and JWT subject are
// scaffolded. This is NOT a running Supabase Auth/PostgREST integration test.
const customer = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const admin = "33333333-3333-4333-8333-333333333333";
const payload = [
  "TixWix Live",
  "host@example.com",
  "+880 1712345678",
  "We organize community concerts and cultural events in Dhaka.",
];
let db: PGlite;
async function asUser<T>(
  id: string | null,
  work: (tx: Transaction) => Promise<T>,
  role = "authenticated",
) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [
      id ?? "",
    ]);
    return work(tx);
  });
}
async function submit(id = customer) {
  return asUser(
    id,
    async (tx) =>
      (
        await tx.query<{ id: string; status: string }>(
          "select * from public.submit_host_application($1,$2,$3,$4)",
          payload,
        )
      ).rows[0],
  );
}
async function review(
  id: string,
  decision = "approved",
  feedback: string | null = null,
  actor = admin,
) {
  return asUser(actor, (tx) =>
    tx.query("select * from public.review_host_application($1,$2,$3)", [
      id,
      decision,
      feedback,
    ]),
  );
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await db.exec(
    readFileSync("supabase/migrations/202611040001_division1.sql", "utf8"),
  );
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec("truncate auth.users cascade");
  for (const id of [customer, other, admin])
    await db.query(
      "insert into auth.users(id, raw_user_meta_data, email_confirmed_at) values ($1, $2, now())",
      [
        id,
        { display_name: "Test user", role: "admin", roles: ["host", "admin"] },
      ],
    );
  await db.query(
    "insert into public.user_roles(user_id,role) values ($1,'admin')",
    [admin],
  );
});

describe("Division 1 PostgreSQL constraints and RLS", () => {
  it("creates only customer privileges from registration even with malicious metadata", async () => {
    const result = await asUser(customer, (tx) =>
      tx.query("select role from public.user_roles"),
    );
    expect(result.rows).toEqual([{ role: "customer" }]);
  });
  it("requires authentication for application submission", async () => {
    await expect(
      asUser(
        null,
        (tx) =>
          tx.query(
            "select * from public.submit_host_application($1,$2,$3,$4)",
            payload,
          ),
        "anon",
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(null, (tx) =>
        tx.query(
          "select * from public.submit_host_application($1,$2,$3,$4)",
          payload,
        ),
      ),
    ).rejects.toThrow(/Authentication required/);
  });
  it("persists an application for the authenticated owner and hides it from other customers", async () => {
    const app = await submit();
    expect(app.status).toBe("pending");
    expect(
      (
        await asUser(customer, (tx) =>
          tx.query("select id from public.host_applications"),
        )
      ).rows,
    ).toEqual([{ id: app.id }]);
    expect(
      (
        await asUser(other, (tx) =>
          tx.query("select * from public.host_applications"),
        )
      ).rows,
    ).toEqual([]);
  });
  it("rejects duplicate pending applications in both RPC and unique constraint", async () => {
    await submit();
    await expect(submit()).rejects.toThrow(/already pending/);
    await expect(
      db.query(
        "insert into public.host_applications(applicant_id,organizer_name,contact_email,contact_phone,description) values ($1,$2,$3,$4,$5)",
        [customer, ...payload],
      ),
    ).rejects.toThrow(/one_pending_application/);
  });
  it("does not allow customers to perform an administrator review", async () => {
    const app = await submit();
    await expect(review(app.id, "approved", null, customer)).rejects.toThrow(
      /Administrator access required/,
    );
  });
  it("atomically approves, grants host access, retains customer, and makes retries idempotent", async () => {
    const app = await submit();
    await review(app.id);
    await review(app.id);
    const result = await asUser(customer, async (tx) => ({
      roles: (
        await tx.query<{ role: string }>(
          "select role from public.user_roles order by role",
        )
      ).rows.map((r) => r.role),
      applications: (
        await tx.query("select status from public.host_applications")
      ).rows,
      hosts: (await tx.query("select user_id from public.host_profiles")).rows,
      reviews: (
        await tx.query(
          "select decision, reviewer_id from public.host_application_reviews",
        )
      ).rows,
      access: (await tx.query("select public.has_role('host') as host")).rows,
    }));
    expect(result.roles).toEqual(["customer", "host"]);
    expect(result.applications).toEqual([{ status: "approved" }]);
    expect(result.hosts).toEqual([{ user_id: customer }]);
    expect(result.reviews).toEqual([
      { decision: "approved", reviewer_id: admin },
    ]);
    expect(result.access).toEqual([{ host: true }]);
    await expect(submit()).rejects.toThrow(/already approved/);
    await expect(review(app.id, "rejected", "Changed mind")).rejects.toThrow(
      /already reviewed/,
    );
  });
  it("rolls all approval writes back if creating the host profile fails", async () => {
    const app = await submit();
    await db.exec(
      "create function public.test_fail_host() returns trigger language plpgsql as $$ begin raise exception 'test failure'; end; $$; create trigger test_fail_host before insert on public.host_profiles for each row execute function public.test_fail_host();",
    );
    try {
      await expect(review(app.id)).rejects.toThrow(/test failure/);
      expect(
        (await db.query("select status from public.host_applications")).rows,
      ).toEqual([{ status: "pending" }]);
      expect(
        (await db.query("select * from public.host_application_reviews")).rows,
      ).toHaveLength(0);
      expect(
        (await db.query("select * from public.user_roles where role = 'host'"))
          .rows,
      ).toHaveLength(0);
    } finally {
      await db.exec(
        "drop trigger test_fail_host on public.host_profiles; drop function public.test_fail_host()",
      );
    }
  });
  it("requires rejection feedback and preserves rejection and review history across resubmission", async () => {
    const first = await submit();
    await expect(review(first.id, "rejected", "  ")).rejects.toThrow(
      /requires feedback/,
    );
    await expect(review(first.id, "rejected", "\n\t\r")).rejects.toThrow(
      /requires feedback/,
    );
    await review(first.id, "rejected", "Please describe your planned venues.");
    expect(
      (
        await asUser(customer, (tx) =>
          tx.query("select public.has_role('host') as host"),
        )
      ).rows,
    ).toEqual([{ host: false }]);
    const second = await submit();
    expect(second.id).not.toBe(first.id);
    expect(
      (
        await asUser(customer, (tx) =>
          tx.query(
            "select previous_application_id from public.host_applications where id = $1",
            [second.id],
          ),
        )
      ).rows,
    ).toEqual([{ previous_application_id: first.id }]);
    expect(
      (
        await asUser(customer, (tx) =>
          tx.query("select feedback from public.host_application_reviews"),
        )
      ).rows,
    ).toEqual([{ feedback: "Please describe your planned venues." }]);
    expect(
      (
        await asUser(other, (tx) =>
          tx.query("select * from public.host_application_reviews"),
        )
      ).rows,
    ).toEqual([]);
    await review(second.id);
    expect(
      (await db.query("select * from public.host_application_reviews")).rows,
    ).toHaveLength(2);
  });
  it("denies direct role, application, host-profile, and review writes", async () => {
    const app = await submit();
    for (const sql of [
      `insert into public.user_roles(user_id,role) values ('${customer}','admin')`,
      `update public.host_applications set status = 'approved' where id = '${app.id}'`,
      `update public.host_applications set reviewed_by = '${customer}'`,
      "delete from public.host_applications",
      "delete from public.host_application_reviews",
      `insert into public.host_profiles(user_id,application_id,organizer_name,contact_email,contact_phone,description) values ('${customer}','${app.id}','x','x','x','x')`,
    ])
      await expect(asUser(customer, (tx) => tx.exec(sql))).rejects.toThrow(
        /permission denied/,
      );
    await expect(
      asUser(admin, (tx) =>
        tx.exec("update public.host_applications set status = 'approved'"),
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("allows ordinary profile edits without allowing ownership, timestamps, or roles to change", async () => {
    await asUser(customer, (tx) =>
      tx.query(
        "update public.profiles set display_name = 'New name' where id = $1",
        [customer],
      ),
    );
    expect(
      (
        await asUser(customer, (tx) =>
          tx.query("select display_name from public.profiles"),
        )
      ).rows,
    ).toEqual([{ display_name: "New name" }]);
    expect(
      (
        await asUser(customer, (tx) =>
          tx.query(
            "update public.profiles set display_name = 'Intruder' where id = $1 returning id",
            [other],
          ),
        )
      ).rows,
    ).toEqual([]);
    await expect(
      asUser(customer, (tx) =>
        tx.exec("update public.profiles set created_at = now()"),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(customer, (tx) =>
        tx.query("update public.profiles set id = $1", [other]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("validates all application fields inside PostgreSQL independently of the HTTP API", async () => {
    for (const invalid of [
      ["x", ...payload.slice(1)],
      ["\n\t", ...payload.slice(1)],
      [payload[0], "not-email", ...payload.slice(2)],
      [payload[0], payload[1], "abc", payload[3]],
      [...payload.slice(0, 3), "short"],
      [...payload.slice(0, 3), "\n".repeat(40)],
    ]) {
      await expect(
        asUser(customer, (tx) =>
          tx.query(
            "select * from public.submit_host_application($1,$2,$3,$4)",
            invalid,
          ),
        ),
      ).rejects.toThrow(/check constraint/);
    }
  });
  it("denies visitors all application tables and prevents unapproved host access", async () => {
    for (const table of [
      "profiles",
      "user_roles",
      "host_applications",
      "host_profiles",
      "host_application_reviews",
    ])
      await expect(
        asUser(null, (tx) => tx.query(`select * from public.${table}`), "anon"),
      ).rejects.toThrow(/permission denied/);
    expect(
      (
        await asUser(customer, (tx) =>
          tx.query(
            "select public.has_role('host') as host, public.has_role('admin') as admin",
          ),
        )
      ).rows,
    ).toEqual([{ host: false, admin: false }]);
  });
  it("lets administrators read all applications and denies nonexistent or invalid decisions", async () => {
    const first = await submit();
    await submit(other);
    expect(
      (
        await asUser(admin, (tx) =>
          tx.query("select id from public.host_applications"),
        )
      ).rows,
    ).toHaveLength(2);
    await expect(review(first.id, "pending")).rejects.toThrow(
      /Invalid review decision/,
    );
    await expect(
      review("44444444-4444-4444-8444-444444444444"),
    ).rejects.toThrow(/Application not found/);
  });
});
