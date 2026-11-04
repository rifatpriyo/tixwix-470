import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/domain";
import { databaseError } from "@/lib/errors";
export class AccountRepository {
  constructor(private db: SupabaseClient<Database>) {}
  async roles(userId: string) {
    const { data, error } = await this.db
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    databaseError(error);
    return (data ?? []).map((x) => x.role);
  }
  async profile(userId: string) {
    const { data, error } = await this.db
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    databaseError(error);
    return data!;
  }
  async updateProfile(userId: string, displayName: string) {
    const { data, error } = await this.db
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", userId)
      .select()
      .single();
    databaseError(error);
    return data!;
  }
  async host(userId: string) {
    const { data, error } = await this.db
      .from("host_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    databaseError(error);
    return data;
  }
}
