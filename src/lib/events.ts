import { z } from "zod";

export const categories = [
  "sports",
  "concert",
  "movie",
  "comedy",
  "other",
] as const;
export const eventStatuses = [
  "draft",
  "changes_requested",
  "pending_review",
  "published",
] as const;
export type EventStatus = (typeof eventStatuses)[number];
export type EventRecord = {
  id: string;
  host_id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  organizer_name: string;
  status: EventStatus;
  version: number;
  created_at: string;
  updated_at: string;
};
export type EventDetail = EventRecord & {
  venue: { name: string; address: string; city: string } | null;
  sessions: { id: string; starts_at: string | null; ends_at: string | null }[];
  tickets: {
    id: string;
    name: string;
    price_minor: number | null;
    capacity: number | null;
  }[];
  poster: string | null;
  next_session: string | null;
  starting_price: number | null;
};
export type EventReview = {
  id: string;
  event_id: string;
  actor_id: string | null;
  previous_status: EventStatus | null;
  new_status: EventStatus;
  feedback: string | null;
  created_at: string;
};
const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    schema.nullable(),
  );
const localTime = z
  .string()
  .refine(
    (v) =>
      !v ||
      (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) &&
        Number.isFinite(Date.parse(`${v}+06:00`)) &&
        new Date(Date.parse(`${v}+06:00`) + 21600000)
          .toISOString()
          .slice(0, 16) === v),
    "Enter a valid Dhaka date and time.",
  );
export const draftSchema = z
  .object({
    title: z.string().trim().max(160),
    description: z.string().trim().max(8000),
    category: z.union([z.enum(categories), z.literal("")]),
    venue_name: z.string().trim().max(160),
    address: z.string().trim().max(500),
    city: z.string().trim().max(100),
    starts_at: localTime,
    ends_at: localTime,
    ticket_name: z.string().trim().max(100),
    price: optionalNumber(
      z
        .number()
        .finite()
        .min(0)
        .max(10000000)
        .refine(
          (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001,
          "Use at most two decimal places.",
        ),
    ),
    capacity: optionalNumber(z.number().int().positive().max(10000000)),
  })
  .superRefine((v, ctx) => {
    if (v.starts_at && v.ends_at && v.ends_at <= v.starts_at)
      ctx.addIssue({
        code: "custom",
        path: ["ends_at"],
        message: "End time must follow start time.",
      });
  });
export const submissionSchema = draftSchema.superRefine((v, ctx) => {
  for (const key of [
    "title",
    "description",
    "category",
    "venue_name",
    "address",
    "city",
    "starts_at",
    "ends_at",
    "ticket_name",
  ] as const)
    if (!v[key])
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: "Required before submitting for review.",
      });
  for (const key of ["price", "capacity"] as const)
    if (v[key] === null)
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: "Required before submitting for review.",
      });
});
export type EventInput = z.infer<typeof draftSchema>;
export const versionSchema = z.number().int().positive();
export const catalogueSchema = z.object({
  q: z.string().trim().max(160).default(""),
  category: z.union([z.enum(categories), z.literal("")]).default(""),
  location: z.string().trim().max(100).default(""),
  date: z
    .string()
    .default("")
    .refine(
      (v) =>
        !v ||
        (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
          Number.isFinite(Date.parse(v)) &&
          new Date(v).toISOString().slice(0, 10) === v),
      "Enter a valid date.",
    ),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type CatalogueFilters = z.infer<typeof catalogueSchema>;
export const dhakaInput = (value?: string | null) =>
  value
    ? new Date(new Date(value).getTime() + 21600000).toISOString().slice(0, 16)
    : "";
export const dhakaDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Dhaka",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Schedule not set";
export const bdt = (minor: number | null) =>
  minor === null
    ? "Price not set"
    : `BDT ${(minor / 100).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
export function eventInput(event: EventDetail): EventInput {
  return {
    title: event.title,
    description: event.description,
    category: event.category as EventInput["category"],
    venue_name: event.venue?.name ?? "",
    address: event.venue?.address ?? "",
    city: event.venue?.city ?? "",
    starts_at: dhakaInput(event.sessions[0]?.starts_at),
    ends_at: dhakaInput(event.sessions[0]?.ends_at),
    ticket_name: event.tickets[0]?.name ?? "",
    price:
      event.tickets[0]?.price_minor == null
        ? null
        : event.tickets[0].price_minor / 100,
    capacity: event.tickets[0]?.capacity ?? null,
  };
}
