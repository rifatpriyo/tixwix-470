import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/domain";
import type { CatalogueFilters, EventInput, EventStatus } from "@/lib/events";
import { AppError, databaseError } from "@/lib/errors";

function check(error: { code?: string } | null) {
  if (error?.code === "PT409" || error?.code === "40001")
    throw new AppError(
      409,
      "This event has changed or is under review. Refresh before trying again.",
      "CONFLICT",
    );
  if (error?.code === "P0002")
    throw new AppError(404, "Event not found.", "NOT_FOUND");
  if (["22023", "23514", "22007", "22008"].includes(error?.code ?? ""))
    throw new AppError(
      422,
      "Check event details, schedule and ticket information.",
      "VALIDATION_ERROR",
    );
  databaseError(error);
}
export class EventRepository {
  constructor(public db: SupabaseClient<Database>) {}
  async find(id: string, publicSlug = false) {
    let query = this.db
      .from("event_details")
      .select("*")
      .eq(publicSlug ? "slug" : "id", id);
    if (publicSlug) query = query.eq("status", "published");
    const { data, error } = await query.maybeSingle();
    check(error);
    return data;
  }
  async list(hostId: string | null, status: EventStatus | "all", page = 1) {
    let query = this.db.from("event_details").select("*", { count: "exact" });
    if (hostId) query = query.eq("host_id", hostId);
    if (status !== "all") query = query.eq("status", status);
    const { data, error, count } = await query
      .order("updated_at", { ascending: false })
      .order("id")
      .range((page - 1) * 20, page * 20 - 1);
    check(error);
    return { events: data ?? [], total: count ?? 0, page, pageSize: 20 };
  }
  async history(id: string) {
    const { data, error } = await this.db
      .from("event_reviews")
      .select("*")
      .eq("event_id", id)
      .order("created_at", { ascending: false })
      .order("id");
    check(error);
    return data ?? [];
  }
  async save(
    id: string | null,
    version: number | null,
    input: EventInput,
    poster: string | null,
  ) {
    const { price, ...fields } = input;
    const { data, error } = await this.db.rpc("save_event", {
      p_id: id,
      p_version: version,
      p_data: {
        ...fields,
        starts_at: input.starts_at ? `${input.starts_at}+06:00` : null,
        ends_at: input.ends_at ? `${input.ends_at}+06:00` : null,
        price_minor: price === null ? null : Math.round(price * 100),
        poster,
      },
    });
    check(error);
    return data!;
  }
  async transition(
    id: string,
    version: number,
    action: string,
    feedback: string | null,
  ) {
    const { data, error } = await this.db.rpc("transition_event", {
      p_id: id,
      p_version: version,
      p_action: action,
      p_feedback: feedback,
    });
    check(error);
    return data!;
  }
  async catalogue(filters: CatalogueFilters) {
    const { data, error } = await this.db.rpc("search_events", {
      p_query: filters.q,
      p_category: filters.category,
      p_location: filters.location,
      p_date: filters.date || null,
      p_page: filters.page,
    });
    check(error);
    return data!;
  }
}
