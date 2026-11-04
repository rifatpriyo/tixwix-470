import { body, endpoint, json, mutationGuard } from "@/controllers/http";
import {
  applicationSchema,
  reviewSchema,
  uuidSchema,
  filterSchema,
  pageSchema,
} from "@/lib/validation";
import { ApplicationRepository } from "@/repositories/applications";
import { ApplicationService } from "@/services/applications";
import { requestContext } from "@/services/context";
import { requireViewer, requireRole } from "@/services/authorization";

async function service(request: Request, admin = false) {
  const context = await requestContext(request);
  if (admin) requireRole(context?.viewer ?? null, "admin");
  else requireViewer(context?.viewer ?? null);
  return new ApplicationService(
    new ApplicationRepository(context!.db),
    context!.viewer,
  );
}
export function ownApplications(request: Request) {
  return endpoint(async () => json(await (await service(request)).own()));
}
export function submitApplication(request: Request) {
  return endpoint(async () => {
    mutationGuard(request);
    const workflow = await service(request);
    const input = applicationSchema.parse(await body(request));
    return json({ application: await workflow.submit(input) }, 201);
  });
}
export function adminApplications(request: Request) {
  return endpoint(async () => {
    const workflow = await service(request, true);
    const params = new URL(request.url).searchParams;
    return json(
      await workflow.list(
        filterSchema.parse(params.get("status") ?? "pending"),
        pageSchema.parse(params.get("page") ?? "1"),
      ),
    );
  });
}
export function applicationDetail(request: Request, id: string) {
  return endpoint(async () => {
    const workflow = await service(request, true);
    return json(await workflow.detail(uuidSchema.parse(id)));
  });
}
export function reviewApplication(request: Request, id: string) {
  return endpoint(async () => {
    mutationGuard(request);
    const workflow = await service(request, true);
    return json({
      application: await workflow.review(
        uuidSchema.parse(id),
        reviewSchema.parse(await body(request)),
      ),
    });
  });
}
