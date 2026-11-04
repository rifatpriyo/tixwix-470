import { body, endpoint, json, mutationGuard } from "@/controllers/http";
import { appOrigin, supabaseConfigured } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { serverClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "@/lib/validation";
import { AuthService } from "@/services/auth";

export function authController(
  request: Request,
  action: "register" | "login" | "logout",
) {
  return endpoint(async () => {
    mutationGuard(request, false);
    const input =
      action === "register"
        ? registerSchema.parse(await body(request))
        : action === "login"
          ? loginSchema.parse(await body(request))
          : null;
    if (!supabaseConfigured())
      throw new AppError(
        503,
        "Account services are not configured yet. Please try again after setup.",
        "SETUP_REQUIRED",
      );
    const auth = new AuthService(await serverClient());
    if (action === "register")
      return json(
        await auth.register(
          input as ReturnType<typeof registerSchema.parse>,
          appOrigin(request.url),
        ),
        201,
      );
    if (action === "login")
      return json(
        await auth.login(input as ReturnType<typeof loginSchema.parse>),
      );
    return json(await auth.logout());
  });
}
