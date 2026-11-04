import { body, endpoint, json, mutationGuard } from "@/controllers/http";
import { profileSchema } from "@/lib/validation";
import { requestContext } from "@/services/context";
import { requireRole, requireViewer } from "@/services/authorization";

export function accountController(request: Request, update = false) {
  return endpoint(async () => {
    if (update) mutationGuard(request);
    const context = await requestContext(request);
    const viewer = requireViewer(context?.viewer ?? null);
    if (update) {
      const input = profileSchema.parse(await body(request));
      return json({
        profile: await context!.accounts.updateProfile(
          viewer.id,
          input.display_name,
        ),
      });
    }
    return json({
      user: viewer,
      profile: await context!.accounts.profile(viewer.id),
    });
  });
}
export function hostController(request: Request) {
  return endpoint(async () => {
    const context = await requestContext(request);
    const viewer = requireRole(context?.viewer ?? null, "host");
    return json({ host: await context!.accounts.host(viewer.id) });
  });
}
