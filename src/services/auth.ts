import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/domain";
import type { z } from "zod";
import { registerSchema, loginSchema } from "@/lib/validation";
import { AppError } from "@/lib/errors";

export class AuthService {
  constructor(private db: SupabaseClient<Database>) {}
  async register(input: z.infer<typeof registerSchema>, origin: string) {
    const { data, error } = await this.db.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { display_name: input.display_name },
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });
    if (error) {
      if (error.status === 429)
        throw new AppError(
          429,
          "Too many attempts. Please wait before trying again.",
        );
      if (error.code === "weak_password")
        throw new AppError(
          422,
          "Choose a stronger password that meets the project's password requirements.",
        );
      throw new AppError(
        400,
        "Unable to create your account. Check your details or try signing in.",
      );
    }
    return data.session
      ? { authenticated: true, redirect: "/dashboard" }
      : {
          authenticated: false,
          message:
            "Check your email for a confirmation link. If you already have an account, sign in instead.",
        };
  }
  async login(input: z.infer<typeof loginSchema>) {
    const { error } = await this.db.auth.signInWithPassword(input);
    if (error?.status === 429)
      throw new AppError(
        429,
        "Too many attempts. Please wait before trying again.",
      );
    if (error?.code === "email_not_confirmed")
      throw new AppError(
        403,
        "Confirm your email using the link in your inbox, then sign in.",
      );
    if (error) throw new AppError(401, "The email or password is incorrect.");
    return { authenticated: true, redirect: "/dashboard" };
  }
  async logout() {
    const { error } = await this.db.auth.signOut({ scope: "local" });
    if (error) throw new AppError(503, "Could not sign out. Please try again.");
    return { redirect: "/login" };
  }
}
