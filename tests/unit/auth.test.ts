import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/domain";
import { AuthService } from "@/services/auth";

// These tests mock Supabase Auth responses; live auth requires the opt-in suite.
function setup() {
  const auth = {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  };
  return {
    auth,
    service: new AuthService({ auth } as unknown as SupabaseClient<Database>),
  };
}
const signup = {
  email: "person@example.com",
  password: "strong-passphrase",
  display_name: "Person",
};
describe("Authentication workflows (mocked Auth provider)", () => {
  it("shows verification instructions when Supabase returns no session", async () => {
    const { auth, service } = setup();
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const result = await service.register(signup, "https://tixwix.example");
    expect(result.authenticated).toBe(false);
    expect(result.message).toContain("confirmation link");
    expect(auth.signUp).toHaveBeenCalledWith({
      email: signup.email,
      password: signup.password,
      options: {
        data: { display_name: signup.display_name },
        emailRedirectTo: "https://tixwix.example/auth/callback",
      },
    });
  });
  it("continues immediately when email verification is disabled", async () => {
    const { auth, service } = setup();
    auth.signUp.mockResolvedValue({
      data: { session: { access_token: "test" } },
      error: null,
    });
    expect(await service.register(signup, "https://tixwix.example")).toEqual({
      authenticated: true,
      redirect: "/dashboard",
    });
  });
  it("handles unconfirmed email, invalid credentials and rate limiting safely", async () => {
    const { auth, service } = setup();
    auth.signInWithPassword.mockResolvedValue({
      error: { code: "email_not_confirmed" },
    });
    await expect(service.login(signup)).rejects.toThrow("Confirm your email");
    auth.signInWithPassword.mockResolvedValue({
      error: {
        code: "invalid_credentials",
        message: "private upstream detail",
      },
    });
    await expect(service.login(signup)).rejects.toThrow(
      "email or password is incorrect",
    );
    auth.signInWithPassword.mockResolvedValue({ error: { status: 429 } });
    await expect(service.login(signup)).rejects.toThrow("Too many attempts");
  });
  it("signs out the current session and reports logout failures", async () => {
    const { auth, service } = setup();
    auth.signOut.mockResolvedValue({ error: null });
    expect(await service.logout()).toEqual({ redirect: "/login" });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    auth.signOut.mockResolvedValue({ error: {} });
    await expect(service.logout()).rejects.toThrow("Could not sign out");
  });
});
