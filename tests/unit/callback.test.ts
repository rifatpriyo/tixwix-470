import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  serverClient: async () => ({ auth }),
}));
import { authCallback } from "@/controllers/callback";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-public-key");
  vi.stubEnv("APP_URL", "https://tixwix.example");
});
afterEach(() => vi.unstubAllEnvs());
describe("Authentication callbacks (mocked Auth provider)", () => {
  it("exchanges a PKCE code and ignores attacker-controlled destinations", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await authCallback(
      new Request(
        "https://tixwix.example/auth/callback?code=test-code&next=https://evil.example",
      ),
      false,
    );
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("test-code");
    expect(response.headers.get("location")).toBe(
      "https://tixwix.example/dashboard",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("verifies a signup token hash and rejects unrelated token types", async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });
    expect(
      (
        await authCallback(
          new Request(
            "https://tixwix.example/auth/confirm?token_hash=test-hash&type=email",
          ),
          true,
        )
      ).headers.get("location"),
    ).toBe("https://tixwix.example/dashboard");
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "test-hash",
      type: "email",
    });
    expect(
      (
        await authCallback(
          new Request(
            "https://tixwix.example/auth/confirm?token_hash=test-hash&type=recovery",
          ),
          true,
        )
      ).headers.get("location"),
    ).toContain("error=confirmation");
  });
  it("returns a safe error for an expired callback without exposing the code", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({
      error: { message: "secret-code" },
    });
    const response = await authCallback(
      new Request("https://tixwix.example/auth/callback?code=secret-code"),
      false,
    );
    expect(response.headers.get("location")).toBe(
      "https://tixwix.example/login?error=confirmation",
    );
  });
});
