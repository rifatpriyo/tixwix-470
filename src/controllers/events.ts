import { randomUUID } from "node:crypto";
import { z } from "zod";
import { body, endpoint, json, mutationGuard } from "@/controllers/http";
import { requestContext } from "@/services/context";
import { requireRole } from "@/services/authorization";
import { EventService, publicEvents } from "@/services/events";
import { EventRepository } from "@/repositories/events";
import {
  catalogueSchema,
  draftSchema,
  eventStatuses,
  versionSchema,
} from "@/lib/events";
import { AppError } from "@/lib/errors";
import { appOrigin } from "@/lib/config";
const uuid = z.string().uuid();
async function service(request: Request, admin = false) {
  const ctx = await requestContext(request);
  requireRole(ctx?.viewer ?? null, admin ? "admin" : "host");
  return new EventService(new EventRepository(ctx!.db), ctx!.viewer);
}
export function listEvents(request: Request, admin = false) {
  return endpoint(async () => {
    const params = new URL(request.url).searchParams;
    const status = z
      .enum([...eventStatuses, "all"])
      .parse(params.get("status") ?? (admin ? "pending_review" : "all"));
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(1000)
      .parse(params.get("page") ?? 1);
    const workflow = await service(request, admin);
    const result = await workflow.list(status, page, admin);
    return json({
      ...result,
      events: await Promise.all(
        result.events.map(async (e) => ({
          ...e,
          reviews: await workflow.repository.history(e.id),
        })),
      ),
    });
  });
}
export function getEvent(request: Request, id: string, admin = false) {
  return endpoint(async () =>
    json(await (await service(request, admin)).detail(uuid.parse(id), admin)),
  );
}
export function saveEvent(request: Request, id: string | null = null) {
  return endpoint(async () => {
    mutationGuard(request);
    const workflow = await service(request);
    const input = z
      .object({
        version: versionSchema.nullable(),
        data: z.unknown(),
        poster: z.string().max(300).nullable(),
      })
      .parse(await body(request));
    const event = await workflow.save(
      id ? uuid.parse(id) : null,
      input.version,
      draftSchema.parse(input.data),
      input.poster,
    );
    return json({ event }, id ? 200 : 201);
  });
}
export function transitionEvent(request: Request, id: string, admin = false) {
  return endpoint(async () => {
    mutationGuard(request);
    const workflow = await service(request, admin);
    const input = z
      .object({
        version: versionSchema,
        action: admin
          ? z.enum(["publish", "request_changes"])
          : z.literal("submit"),
        feedback: z.string().trim().max(2000).nullable().optional(),
      })
      .superRefine((v, c) => {
        if (v.action === "request_changes" && !v.feedback)
          c.addIssue({
            code: "custom",
            path: ["feedback"],
            message: "Explain the correction needed.",
          });
      })
      .parse(await body(request));
    return json({
      event: await workflow.transition(
        uuid.parse(id),
        input.version,
        input.action,
        input.feedback ?? null,
      ),
    });
  });
}
export function catalogue(request: Request) {
  return endpoint(async () =>
    json(
      await publicEvents().catalogue(
        catalogueSchema.parse(
          Object.fromEntries(new URL(request.url).searchParams),
        ),
      ),
    ),
  );
}
export function publicDetail(slug: string) {
  return endpoint(async () => {
    const event = await publicEvents().find(slug, true);
    if (!event) throw new AppError(404, "Event unavailable.");
    return json({ event });
  });
}
export function uploadPoster(request: Request, id: string) {
  return endpoint(async () => {
    if (
      !/^Bearer \S+$/i.test(request.headers.get("authorization") ?? "") &&
      (request.headers.get("origin") !== appOrigin(request.url) ||
        request.headers.get("sec-fetch-site") === "cross-site")
    )
      throw new AppError(403, "This request must come from TixWix.");
    const workflow = await service(request);
    const { event } = await workflow.detail(uuid.parse(id));
    if (event.status === "pending_review")
      throw new AppError(409, "Pending submissions are read-only.");
    // Stream into a bounded buffer before parsing multipart data.
    const reader = request.body?.getReader();
    if (!reader) throw new AppError(400, "Choose a poster.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 5242880 + 16384) {
        await reader.cancel();
        throw new AppError(413, "Poster must be at most 5 MB.");
      }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    const form = await new Response(bytes, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
    const file = form.get("poster");
    if (!(file instanceof File) || file.size > 5242880 || file.size === 0)
      throw new AppError(422, "Choose a JPEG, PNG or WebP poster up to 5 MB.");
    const content = Buffer.from(await file.arrayBuffer());
    const type = content
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? "image/png"
      : content[0] === 255 && content[1] === 216 && content[2] === 255
        ? "image/jpeg"
        : content.toString("ascii", 0, 4) === "RIFF" &&
            content.toString("ascii", 8, 12) === "WEBP"
          ? "image/webp"
          : null;
    if (!type || file.type !== type)
      throw new AppError(
        422,
        "Poster content must match its JPEG, PNG or WebP file type.",
      );
    const path = `${event.host_id}/${event.id}/${randomUUID()}.${type.split("/")[1]}`;
    const result = await workflow.repository.db.storage
      .from("event-posters")
      .upload(path, content, {
        contentType: type,
        upsert: false,
        cacheControl: "0",
      });
    if (result.error)
      throw new AppError(503, "Poster upload failed. Try again.");
    return json({ path }, 201);
  });
}
export function posterImage(request: Request, id: string) {
  return endpoint(async () => {
    uuid.parse(id);
    const context = await requestContext(request);
    const repo = context ? new EventRepository(context.db) : publicEvents();
    const event = await repo.find(id);
    if (!event?.poster) throw new AppError(404, "Poster unavailable.");
    const { data, error } = await repo.db.storage
      .from("event-posters")
      .download(event.poster);
    if (error || !data) throw new AppError(404, "Poster unavailable.");
    return new Response(data, {
      headers: {
        "Content-Type": data.type,
        "Cache-Control": "private, no-store, max-age=0",
        Vary: "Cookie, Authorization",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
