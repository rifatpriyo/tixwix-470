import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/domain";
import type { CheckoutInput, SeatingInput } from "@/lib/reservations";
import { AppError } from "@/lib/errors";
function check(error: { code?: string } | null) {
  if (!error) return;
  if (["PT409", "23505", "40001"].includes(error.code ?? ""))
    throw new AppError(
      409,
      "Inventory changed or this retry key was used for another selection. Refresh availability and try again.",
      "CONFLICT",
    );
  if (error.code === "42501")
    throw new AppError(
      403,
      "You do not have access to this action.",
      "FORBIDDEN",
    );
  if (error.code === "P0002")
    throw new AppError(404, "Session or reservation unavailable.", "NOT_FOUND");
  if (["22023", "22P02", "23514"].includes(error.code ?? ""))
    throw new AppError(
      422,
      "Check the ticket selection or seating layout.",
      "VALIDATION_ERROR",
    );
  throw new AppError(
    503,
    "Reservations are temporarily unavailable. Retry with the same selection.",
    "DATABASE_UNAVAILABLE",
  );
}
export class ReservationRepository {
  constructor(readonly db: SupabaseClient<Database>) {}
  async availability(session: string) {
    const { data, error } = await this.db.rpc("session_availability", {
      p_session: session,
    });
    check(error);
    return data!;
  }
  async create(input: CheckoutInput) {
    const { data, error } = await this.db.rpc("create_reservation", {
      p_session: input.session_id,
      p_key: input.idempotency_key,
      p_seats: input.seat_ids,
      p_ga: input.general_admission,
    });
    check(error);
    return data!;
  }
  async get(id: string, release = false) {
    const { data, error } = await this.db.rpc("reservation", {
      p_id: id,
      p_release: release,
    });
    check(error);
    return data!;
  }
  async seating(event: string, input: SeatingInput) {
    const { error } = await this.db.rpc("assign_seating", {
      p_event: event,
      p_version: input.version,
      p_category: input.category_id,
      p_rows: input.rows,
      p_columns: input.columns,
    });
    check(error);
  }
}
