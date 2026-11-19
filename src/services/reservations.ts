import "server-only";
import type { Viewer } from "@/lib/domain";
import { ReservationRepository } from "@/repositories/reservations";
import { requireRole } from "@/services/authorization";
import {
  checkoutSchema,
  seatingSchema,
  type CheckoutInput,
  type SeatingInput,
} from "@/lib/reservations";
export class ReservationService {
  constructor(
    readonly repository: ReservationRepository,
    readonly viewer: Viewer,
  ) {}
  create(input: CheckoutInput) {
    requireRole(this.viewer, "customer");
    return this.repository.create(checkoutSchema.parse(input));
  }
  get(id: string, release = false) {
    requireRole(this.viewer, "customer");
    return this.repository.get(id, release);
  }
  seating(event: string, input: SeatingInput) {
    requireRole(this.viewer, "host");
    return this.repository.seating(event, seatingSchema.parse(input));
  }
}
