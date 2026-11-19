import { z } from "zod";
export const checkoutSchema = z
  .object({
    session_id: z.string().uuid(),
    idempotency_key: z.string().uuid(),
    seat_ids: z.array(z.string().uuid()).max(20).default([]),
    general_admission: z
      .array(
        z.object({
          category_id: z.string().uuid(),
          quantity: z.number().int().min(1).max(20),
        }),
      )
      .max(20)
      .default([]),
  })
  .superRefine((v, c) => {
    const quantity =
      v.seat_ids.length +
      v.general_admission.reduce((n, i) => n + i.quantity, 0);
    if (
      quantity < 1 ||
      quantity > 20 ||
      new Set(v.seat_ids).size !== v.seat_ids.length ||
      new Set(v.general_admission.map((i) => i.category_id)).size !==
        v.general_admission.length
    )
      c.addIssue({
        code: "custom",
        message: "Choose 1–20 tickets without duplicates.",
      });
  });
export const seatingSchema = z.object({
  version: z.number().int().positive(),
  category_id: z.string().uuid(),
  rows: z.number().int().min(1).max(8),
  columns: z.number().int().min(1).max(12),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type SeatingInput = z.infer<typeof seatingSchema>;
export type Seat = {
  id: string;
  category_id: string;
  section: string;
  row_label: string;
  row_index: number;
  seat_number: number;
  columns: number;
  label: string;
  available: boolean;
};
export type Inventory = {
  session_id: string;
  server_now: string;
  eligible: boolean;
  preview: string | null;
  seats: Seat[];
  categories: {
    id: string;
    name: string;
    price_minor: number;
    kind: "numbered" | "general_admission";
    remaining: number | null;
  }[];
};
export type Reservation = {
  id: string;
  event_id: string;
  session_id: string;
  state: "pending" | "canceled" | "expired";
  expires_at: string;
  created_at: string;
  total_minor: number;
  currency: "BDT";
  server_now: string;
  items: {
    id: string;
    category_id: string;
    seat_id: string | null;
    label: string;
    category_name: string;
    quantity: number;
    unit_price_minor: number;
  }[];
};
