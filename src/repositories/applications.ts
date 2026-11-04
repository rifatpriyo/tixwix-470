import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  ApplicationStatus,
  HostApplication,
} from "@/lib/domain";
import type { ApplicationInput, ReviewInput } from "@/lib/validation";
import { databaseError } from "@/lib/errors";
export class ApplicationRepository {
  constructor(private db: SupabaseClient<Database>) {}
  async own(userId: string) {
    const { data, error } = await this.db
      .from("host_applications")
      .select("*")
      .eq("applicant_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    databaseError(error);
    return data ?? [];
  }
  async list(status: ApplicationStatus | "all", page: number) {
    let query = this.db
      .from("host_applications")
      .select("*", { count: "exact" });
    if (status !== "all") query = query.eq("status", status);
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * 20, page * 20 - 1);
    databaseError(error);
    return { applications: data ?? [], total: count ?? 0, page, pageSize: 20 };
  }
  async find(id: string) {
    const { data, error } = await this.db
      .from("host_applications")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    databaseError(error);
    return data;
  }
  async reviews(applicationIds: string[]) {
    if (!applicationIds.length) return [];
    const { data, error } = await this.db
      .from("host_application_reviews")
      .select("*")
      .in("application_id", applicationIds)
      .order("created_at", { ascending: false });
    databaseError(error);
    return data ?? [];
  }
  async submit(input: ApplicationInput) {
    const { data, error } = await this.db
      .rpc("submit_host_application", {
        p_organizer_name: input.organizer_name,
        p_contact_email: input.contact_email,
        p_contact_phone: input.contact_phone,
        p_description: input.description,
      })
      .single<HostApplication>();
    databaseError(error);
    return data!;
  }
  async review(id: string, input: ReviewInput) {
    const { data, error } = await this.db
      .rpc("review_host_application", {
        p_application_id: id,
        p_decision: input.decision,
        p_feedback: input.feedback || null,
      })
      .single<HostApplication>();
    databaseError(error);
    return data!;
  }
}
