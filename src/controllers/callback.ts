import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { appOrigin, supabaseConfigured } from "@/lib/config";

export async function authCallback(request: Request, confirmation: boolean) {
  const url = new URL(request.url);
  const origin = appOrigin(request.url);
  const response = (path: string) => {
    const result = NextResponse.redirect(new URL(path, origin));
    result.headers.set("Cache-Control", "private, no-store");
    result.headers.set("Referrer-Policy", "no-referrer");
    return result;
  };
  if (!supabaseConfigured()) return response("/login?error=setup");
  const db = await serverClient();
  try {
    if (confirmation) {
      const token_hash = url.searchParams.get("token_hash");
      // This division supports signup confirmation only, never arbitrary auth action types.
      if (token_hash && url.searchParams.get("type") === "email") {
        const { error } = await db.auth.verifyOtp({
          token_hash,
          type: "email",
        });
        if (!error) return response("/dashboard");
      }
    } else {
      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await db.auth.exchangeCodeForSession(code);
        if (!error) return response("/dashboard");
      }
    }
  } catch {
    /* Show safe recovery instructions; never echo confirmation tokens. */
  }
  return response("/login?error=confirmation");
}
