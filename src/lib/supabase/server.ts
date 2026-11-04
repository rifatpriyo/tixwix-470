import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/domain";
import { supabaseConfig } from "@/lib/config";

export async function serverClient(request?: Request) {
  const { url, key } = supabaseConfig();
  const authorization = request?.headers.get("authorization");
  if (authorization) {
    // Native clients supply their Supabase access token. No service-role bypass.
    return createClient<Database>(url, key, {
      global: { headers: { Authorization: authorization } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  const jar = await cookies();
  return createServerClient<Database>(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          /* Read-only Server Components; proxy refreshes cookies before rendering. */
        }
      },
    },
  });
}
