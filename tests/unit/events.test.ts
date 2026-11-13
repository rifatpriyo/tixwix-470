import { describe, it, expect } from "vitest";
import {
  draftSchema,
  submissionSchema,
  catalogueSchema,
  bdt,
  dhakaInput,
} from "@/lib/events";
const draft = {
  title: "",
  description: "",
  category: "",
  venue_name: "",
  address: "",
  city: "",
  starts_at: "",
  ends_at: "",
  ticket_name: "",
  price: "",
  capacity: "",
};
describe("event validation", () => {
  it("allows incomplete drafts but gives field errors on submission", () => {
    expect(draftSchema.parse(draft).price).toBeNull();
    const parsed = submissionSchema.safeParse(draft);
    expect(parsed.success).toBe(false);
    if (!parsed.success)
      expect(parsed.error.issues.map((i) => i.path[0])).toContain("title");
  });
  it("rejects bad dates, fractional capacity, negative prices and excess precision", () => {
    for (const input of [
      { starts_at: "2027-02-30T18:00" },
      { starts_at: "2027-02-20T18:00", ends_at: "2027-02-20T18:00" },
      { capacity: "1.5" },
      { price: "-1" },
      { price: "1.001" },
    ])
      expect(draftSchema.safeParse({ ...draft, ...input }).success).toBe(false);
  });
  it("bounds pagination and validates a Dhaka date", () => {
    expect(catalogueSchema.safeParse({ date: "2027-02-30" }).success).toBe(
      false,
    );
    expect(catalogueSchema.safeParse({ page: 1001 }).success).toBe(false);
    expect(dhakaInput("2027-12-19T18:30:00Z")).toBe("2027-12-20T00:30");
    expect(bdt(50000)).toBe("BDT 500");
  });
});
