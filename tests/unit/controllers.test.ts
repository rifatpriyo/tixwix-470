import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/services/context", () => ({ requestContext: vi.fn() }));
import { requestContext } from "@/services/context";
import {
  adminApplications,
  applicationDetail,
  ownApplications,
  reviewApplication,
  submitApplication,
} from "@/controllers/applications";
import { accountController, hostController } from "@/controllers/accounts";
const context = vi.mocked(requestContext);
const request = (method = "GET", payload?: unknown) =>
  new Request("http://localhost:3000/api/host-applications", {
    method,
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
const customerContext = {
  viewer: {
    id: "customer-id",
    email: "person@example.com",
    roles: ["customer"],
  },
  db: {},
  accounts: {},
} as unknown as NonNullable<Awaited<ReturnType<typeof requestContext>>>;
beforeEach(() => {
  vi.clearAllMocks();
  context.mockResolvedValue(null);
});
describe("Direct API authorization (mocked identity, actual controllers)", () => {
  it("returns 401 from protected APIs when no identity is validated", async () => {
    for (const response of [
      await ownApplications(request()),
      await adminApplications(request()),
      await hostController(request()),
      await accountController(request()),
      await submitApplication(request("POST", {})),
      await reviewApplication(request("POST", {}), "anything"),
    ])
      expect(response.status).toBe(401);
  });
  it("rejects customers at every administrator entry point and the host API", async () => {
    context.mockResolvedValue(customerContext);
    for (const response of [
      await adminApplications(request()),
      await applicationDetail(request(), "anything"),
      await reviewApplication(request("POST", {}), "anything"),
      await hostController(request()),
    ])
      expect(response.status).toBe(403);
  });
  it("rejects forged fields on profile and application writes before repository access", async () => {
    context.mockResolvedValue(customerContext);
    expect(
      (
        await accountController(
          request("PATCH", { display_name: "Person", role: "admin" }),
          true,
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await submitApplication(
          request("POST", { applicant_id: "someone-else" }),
        )
      ).status,
    ).toBe(422);
  });
});
