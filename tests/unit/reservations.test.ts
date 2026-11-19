import { describe, it, expect } from "vitest";
import { checkoutSchema, seatingSchema } from "@/lib/reservations";
const id = "11111111-1111-4111-8111-111111111111";
describe("reservation input validation", () => {
  it("accepts session-bound numbered and admission tickets", () => {
    expect(
      checkoutSchema.parse({
        session_id: id,
        idempotency_key: id,
        seat_ids: [id],
      }).seat_ids,
    ).toEqual([id]);
  });
  it("rejects duplicates, missing sessions, empty selections, fractions and excessive quantities", () => {
    const base = { session_id: id, idempotency_key: id };
    for (const input of [
      { ...base },
      { ...base, seat_ids: [id, id] },
      { idempotency_key: id, seat_ids: [id] },
      { ...base, general_admission: [{ category_id: id, quantity: 1.5 }] },
      { ...base, general_admission: [{ category_id: id, quantity: 21 }] },
    ])
      expect(checkoutSchema.safeParse(input).success).toBe(false);
  });
  it("bounds layout dimensions and requires optimistic version", () => {
    expect(
      seatingSchema.safeParse({
        version: 1,
        category_id: id,
        rows: 4,
        columns: 6,
      }).success,
    ).toBe(true);
    expect(
      seatingSchema.safeParse({ category_id: id, rows: 9, columns: 6 }).success,
    ).toBe(false);
  });
});
