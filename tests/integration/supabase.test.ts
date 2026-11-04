import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database, HostApplication } from "@/lib/domain";

// Opt-in only: creates temporary users in a dedicated migrated Supabase project.
// Never falls back to mock persistence. No destructive database resets.
const enabled =
  process.env.SUPABASE_TEST_ALLOW_USER_CREATION === "true" &&
  !!process.env.SUPABASE_TEST_URL &&
  !!process.env.SUPABASE_TEST_PUBLISHABLE_KEY &&
  !!process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const payload = {
  p_organizer_name: "Integration organizer",
  p_contact_email: "organizer@example.com",
  p_contact_phone: "+8801712345678",
  p_description:
    "Community events and concerts for local students and families.",
};
const ids: string[] = [];
let owner: SupabaseClient<Database>,
  customer: SupabaseClient<Database>,
  other: SupabaseClient<Database>,
  admin: SupabaseClient<Database>;
let customerId: string;
let customerEmail: string;
const password = `TixWix-${randomUUID()}!`;
const client = () =>
  createClient<Database>(
    process.env.SUPABASE_TEST_URL!,
    process.env.SUPABASE_TEST_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

describe.skipIf(!enabled)(
  "Real Supabase Auth and PostgREST integration",
  () => {
    beforeAll(async () => {
      owner = createClient<Database>(
        process.env.SUPABASE_TEST_URL!,
        process.env.SUPABASE_TEST_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const create = async (name: string) => {
        const email = `tixwix-${name}-${randomUUID()}@example.com`;
        const { data, error } = await owner.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { display_name: name, role: "admin" },
        });
        if (error || !data.user)
          throw new Error(
            `Test account setup failed: ${error?.code ?? "unknown"}`,
          );
        ids.push(data.user.id);
        const db = client();
        const login = await db.auth.signInWithPassword({ email, password });
        expect(login.error).toBeNull();
        return { db, id: data.user.id, email };
      };
      const a = await create("customer");
      customer = a.db;
      customerId = a.id;
      customerEmail = a.email;
      other = (await create("other")).db;
      const c = await create("admin");
      admin = c.db;
      const grant = await owner
        .from("user_roles")
        .insert({ user_id: c.id, role: "admin" });
      expect(grant.error).toBeNull();
    });
    afterAll(async () => {
      if (owner)
        for (const id of ids.reverse()) {
          const result = await owner.auth.admin.deleteUser(id);
          if (result.error)
            throw new Error(
              `Remove temporary test account ${id} manually; cleanup failed.`,
            );
        }
    });
    it("authenticates users, ignores role metadata, and reuses an actual session", async () => {
      const { data } = await customer.auth.getSession();
      expect(data.session).not.toBeNull();
      const fresh = client();
      const result = await fresh.auth.setSession({
        access_token: data.session!.access_token,
        refresh_token: data.session!.refresh_token,
      });
      expect(result.error).toBeNull();
      expect((await fresh.auth.getUser()).data.user?.id).toBe(customerId);
      expect((await customer.from("user_roles").select("role")).data).toEqual([
        { role: "customer" },
      ]);
    });
    it("enforces ownership, concurrent pending submissions, rejection, resubmission, atomic approval and idempotency", async () => {
      const attempts = await Promise.all([
        customer
          .rpc("submit_host_application", payload)
          .single<HostApplication>(),
        customer
          .rpc("submit_host_application", payload)
          .single<HostApplication>(),
      ]);
      expect(attempts.filter((x) => !x.error)).toHaveLength(1);
      expect(attempts.filter((x) => x.error?.code === "23505")).toHaveLength(1);
      const first = attempts.find((x) => !x.error)!.data!;
      expect(
        (await other.from("host_applications").select("*").eq("id", first.id))
          .data,
      ).toEqual([]);
      expect(
        (
          await customer.rpc("review_host_application", {
            p_application_id: first.id,
            p_decision: "approved",
            p_feedback: null,
          })
        ).error?.code,
      ).toBe("42501");
      expect(
        (
          await customer
            .from("user_roles")
            .insert({ user_id: customerId, role: "admin" })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await customer
            .from("host_applications")
            .update({ status: "approved" })
            .eq("id", first.id)
        ).error,
      ).not.toBeNull();
      expect(
        (await client().rpc("submit_host_application", payload)).error,
      ).not.toBeNull();
      expect(
        (await customer.rpc("has_role", { requested_role: "host" })).data,
      ).toBe(false);
      expect(
        (
          await admin.rpc("review_host_application", {
            p_application_id: first.id,
            p_decision: "rejected",
            p_feedback: "Please add venue details.",
          })
        ).error,
      ).toBeNull();
      const history = await customer
        .from("host_application_reviews")
        .select("*");
      expect(history.data?.[0].feedback).toBe("Please add venue details.");
      const second = await customer
        .rpc("submit_host_application", {
          ...payload,
          p_description: `${payload.p_description} Planned venue: Dhaka auditorium.`,
        })
        .single<HostApplication>();
      expect(second.error).toBeNull();
      expect(second.data?.previous_application_id).toBe(first.id);
      const reviews = await Promise.all(
        [1, 2].map(() =>
          admin.rpc("review_host_application", {
            p_application_id: second.data!.id,
            p_decision: "approved",
            p_feedback: null,
          }),
        ),
      );
      expect(reviews.every((r) => !r.error)).toBe(true);
      expect(
        (await customer.rpc("has_role", { requested_role: "host" })).data,
      ).toBe(true);
      expect(
        (await customer.from("host_profiles").select("*")).data,
      ).toHaveLength(1);
      expect(
        (await customer.from("host_application_reviews").select("*")).data,
      ).toHaveLength(2);
      expect(
        (await other.from("host_application_reviews").select("*")).data,
      ).toHaveLength(0);
    });
    it("signs out and signs back in with the same approved account", async () => {
      expect(
        (await customer.auth.signOut({ scope: "local" })).error,
      ).toBeNull();
      expect((await customer.auth.getSession()).data.session).toBeNull();
      expect(
        (
          await customer.auth.signInWithPassword({
            email: customerEmail,
            password,
          })
        ).error,
      ).toBeNull();
      expect(
        (await customer.rpc("has_role", { requested_role: "host" })).data,
      ).toBe(true);
    });
  },
);
