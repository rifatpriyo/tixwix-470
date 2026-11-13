import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("@/services/context", () => ({ requestContext: vi.fn() }));
import { requestContext } from "@/services/context";
import { saveEvent, listEvents, transitionEvent } from "@/controllers/events";
const context = vi.mocked(requestContext);
const request = (data?: unknown) =>
  new Request("http://localhost:3000/api/host/events", {
    method: data ? "POST" : "GET",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
const host = {
  db: {},
  accounts: {},
  viewer: {
    id: "11111111-1111-4111-8111-111111111111",
    email: "host@example.com",
    roles: ["host"],
  },
} as unknown as NonNullable<Awaited<ReturnType<typeof requestContext>>>;
beforeEach(() => {
  context.mockResolvedValue(null);
});
describe("event controllers (mocked identity)", () => {
  it("denies anonymous users and customer event creation", async () => {
    expect((await listEvents(request())).status).toBe(401);
    context.mockResolvedValue({
      ...host,
      viewer: { ...host.viewer, roles: ["customer"] },
    });
    expect((await saveEvent(request({}))).status).toBe(403);
    expect(
      (await transitionEvent(request({}), host.viewer.id, true)).status,
    ).toBe(403);
  });
  it("returns errors keyed by the edited field rather than a nested data key", async () => {
    context.mockResolvedValue(host);
    const response = await saveEvent(
      request({
        version: null,
        poster: null,
        data: {
          title: "",
          description: "",
          category: "",
          venue_name: "",
          address: "",
          city: "",
          starts_at: "2027-02-20T20:00",
          ends_at: "2027-02-20T19:00",
          ticket_name: "",
          price: -1,
          capacity: 1,
        },
      }),
    );
    expect(response.status).toBe(422);
    const result = await response.json();
    expect(result.fields.price).toBeDefined();
    expect(result.fields.ends_at).toBeDefined();
    expect(result.fields.data).toBeUndefined();
  });
  it("rejects cross-origin event mutations", async () => {
    context.mockResolvedValue(host);
    const response = await saveEvent(
      new Request("http://localhost:3000/api/host/events", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
          "content-type": "application/json",
        },
        body: "{}",
      }),
    );
    expect(response.status).toBe(403);
  });
});
