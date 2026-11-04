import { describe, expect, it } from "vitest";
import {
  applicationSchema,
  registerSchema,
  reviewSchema,
  profileSchema,
} from "@/lib/validation";
import { requireRole, requireViewer } from "@/services/authorization";
import { mutationGuard, body, endpoint } from "@/controllers/http";
import { AppError } from "@/lib/errors";
const input = {
  organizer_name: "A host",
  contact_email: "host@example.com",
  contact_phone: "+8801712345678",
  description: "Concerts and cultural events for the local community.",
};

describe("HTTP validation and authorization", () => {
  it("rejects protected fields in registration, profile updates, and application data", () => {
    expect(
      registerSchema.safeParse({
        display_name: "Alice",
        email: "alice@example.com",
        password: "long-password",
        role: "admin",
      }).success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({ display_name: "Alice", role: "host" }).success,
    ).toBe(false);
    for (const field of [
      "applicant_id",
      "reviewed_by",
      "status",
      "reviewed_at",
    ])
      expect(
        applicationSchema.safeParse({ ...input, [field]: "approved" }).success,
      ).toBe(false);
  });
  it("normalizes input and gives a feedback error for empty rejections", () => {
    expect(
      applicationSchema.parse({ ...input, organizer_name: "  A host  " })
        .organizer_name,
    ).toBe("A host");
    const result = reviewSchema.safeParse({
      decision: "rejected",
      feedback: "  ",
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].path).toEqual(["feedback"]);
  });
  it("requires authentication and explicit protected roles", () => {
    expect(() => requireViewer(null)).toThrow("Sign in");
    const viewer = {
      id: "customer",
      email: "test@example.com",
      roles: ["customer"] as const,
    };
    expect(() =>
      requireRole({ ...viewer, roles: [...viewer.roles] }, "admin"),
    ).toThrow("admin access");
    expect(() =>
      requireRole({ ...viewer, roles: [...viewer.roles] }, "host"),
    ).toThrow("host access");
  });
  it("rejects cross-site and originless cookie mutations but supports native bearer clients", () => {
    const make = (headers: Record<string, string>) =>
      new Request("http://localhost:3000/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...headers },
      });
    expect(() =>
      mutationGuard(make({ origin: "https://evil.example" })),
    ).toThrow("must come from TixWix");
    expect(() => mutationGuard(make({}))).toThrow("must come from TixWix");
    expect(() =>
      mutationGuard(make({ origin: "http://localhost:3000" })),
    ).not.toThrow();
    expect(() =>
      mutationGuard(make({ authorization: "Bearer native-token" })),
    ).not.toThrow();
    expect(() =>
      mutationGuard(make({ authorization: "Bearer native-token" }), false),
    ).toThrow();
  });
  it("bounds and parses request bodies without accepting malformed JSON", async () => {
    await expect(
      body(new Request("http://localhost", { method: "POST", body: "{" })),
    ).rejects.toThrow("valid JSON");
    await expect(
      body(
        new Request("http://localhost", {
          method: "POST",
          body: "x".repeat(16385),
        }),
      ),
    ).rejects.toThrow("too large");
    expect(
      await body(
        new Request("http://localhost", { method: "POST", body: '{"a":1}' }),
      ),
    ).toEqual({ a: 1 });
  });
  it("returns explicit non-cacheable authorization failures", async () => {
    const response = await endpoint(async () => {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    });
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({
      error: "Forbidden",
      code: "FORBIDDEN",
    });
  });
});
