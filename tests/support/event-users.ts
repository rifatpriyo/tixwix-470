import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/domain";
export type TestUser = {
  role: string;
  id: string;
  email: string;
  password: string;
};
export function eventUsers(): TestUser[] {
  return JSON.parse(
    readFileSync(process.env.SUPABASE_TEST_EVENT_USERS_FILE!, "utf8"),
  );
}
export function eventClient() {
  return createClient<Database>(
    process.env.SUPABASE_TEST_URL!,
    process.env.SUPABASE_TEST_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function loginEventUser(role: string) {
  const user = eventUsers().find((u) => u.role === role)!;
  const db = eventClient();
  const { error } = await db.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw error;
  return { db, user };
}
export async function approveTestHosts() {
  const { db: admin } = await loginEventUser("admin");
  for (const role of ["host", "other"]) {
    const { db } = await loginEventUser(role);
    const existing = await db.from("host_profiles").select("user_id");
    if (existing.error) throw existing.error;
    if (existing.data.length) continue;
    const { data, error } = await db.rpc("submit_host_application", {
      p_organizer_name: `Division 2 ${role}`,
      p_contact_email: "private-contact@example.com",
      p_contact_phone: "+8801712345678",
      p_description:
        "Community concerts and cultural events for local students.",
    });
    if (error) throw error;
    const result = await admin.rpc("review_host_application", {
      p_application_id: data.id,
      p_decision: "approved",
      p_feedback: null,
    });
    if (result.error) throw result.error;
  }
}
