import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
const url = process.env.SUPABASE_TEST_URL;
const connectionString = process.env.SUPABASE_TEST_DB_URL;
for (const value of [url, connectionString])
  if (
    !value ||
    !["127.0.0.1", "localhost", "[::1]"].includes(new URL(value).hostname)
  )
    throw new Error(
      "Demo seeding requires explicit loopback SUPABASE_TEST_URL and SUPABASE_TEST_DB_URL.",
    );
const adminApi = createClient(url, process.env.SUPABASE_TEST_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const db = new Client({ connectionString });
await db.connect();
const users = [];
const run = randomUUID().slice(0, 8);
function unwrap(result) {
  if (result.error) throw result.error;
  return result.data;
}
try {
  const applied = await db.query(
    "select to_regprocedure('public.create_reservation(uuid,uuid,uuid[],jsonb)') name",
  );
  if (!applied.rows[0].name)
    throw new Error("Apply all local migrations before seeding.");
  for (const role of ["admin", "host", "customer", "customer_b"]) {
    const password = randomUUID() + "Aa1!";
    const email = `s2-${run}-${role}@example.test`;
    const { user } = unwrap(
      await adminApi.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      }),
    );
    users.push({ role, id: user.id, email, password });
  }
  await db.query(
    "insert into public.user_roles(user_id,role) values($1,'admin')",
    [users[0].id],
  );
  async function client(role) {
    const u = users.find((u) => u.role === role);
    const c = createClient(url, process.env.SUPABASE_TEST_PUBLISHABLE_KEY, {
      auth: { persistSession: false },
    });
    unwrap(
      await c.auth.signInWithPassword({ email: u.email, password: u.password }),
    );
    return c;
  }
  const host = await client("host"),
    admin = await client("admin");
  const application = unwrap(
    await host.rpc("submit_host_application", {
      p_organizer_name: "TixWix Demo",
      p_contact_email: "host@example.test",
      p_contact_phone: "+8801712345678",
      p_description:
        "We organize small concerts and community cultural events in Dhaka.",
    }),
  );
  unwrap(
    await admin.rpc("review_host_application", {
      p_application_id: application.id,
      p_decision: "approved",
      p_feedback: null,
    }),
  );
  const event = unwrap(
    await host.rpc("save_event", {
      p_id: null,
      p_version: null,
      p_data: {
        title: `Concert Hall Demo ${run}`,
        description: "Four rows, two sessions, and separate general admission.",
        category: "concert",
        venue_name: "Demo Concert Hall",
        address: "Dhanmondi, Dhaka",
        city: "Dhaka",
        starts_at: "2099-12-20T14:00:00+06:00",
        ends_at: "2099-12-20T16:00:00+06:00",
        ticket_name: "Numbered seats",
        price_minor: 50000,
        capacity: 24,
      },
    }),
  );
  const category = (
    await db.query(
      "select id from public.event_ticket_categories where event_id=$1",
      [event.id],
    )
  ).rows[0].id;
  unwrap(
    await host.rpc("assign_seating", {
      p_event: event.id,
      p_version: event.version,
      p_category: category,
      p_rows: 4,
      p_columns: 6,
    }),
  );
  await db.query(
    "insert into public.event_sessions(event_id,starts_at,ends_at) values($1,'2099-12-20T18:00:00+06:00','2099-12-20T20:00:00+06:00')",
    [event.id],
  );
  await db.query(
    "insert into public.event_ticket_categories(event_id,name,price_minor,capacity) values($1,'General admission',25000,5)",
    [event.id],
  );
  unwrap(
    await host.rpc("transition_event", {
      p_id: event.id,
      p_version: 2,
      p_action: "submit",
      p_feedback: null,
    }),
  );
  unwrap(
    await admin.rpc("transition_event", {
      p_id: event.id,
      p_version: 3,
      p_action: "publish",
      p_feedback: null,
    }),
  );
  mkdirSync(".qa", { recursive: true });
  writeFileSync(
    ".qa/reservation-demo-users.json",
    JSON.stringify(users, null, 2),
  );
  writeFileSync(
    ".qa/reservation-demo.json",
    JSON.stringify({ event_id: event.id, slug: event.slug }, null, 2),
  );
  console.log(
    `Demo: /events/${event.slug}. Credentials saved only in ignored .qa/reservation-demo-users.json.`,
  );
} finally {
  await db.end();
}
