import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { appOrigin } from "@/lib/config";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie, Authorization",
    },
  });
}
export async function endpoint(work: () => Promise<Response>) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof z.ZodError)
      return json(
        {
          error: "Check the highlighted fields.",
          code: "VALIDATION_ERROR",
          fields: z.flattenError(error).fieldErrors,
        },
        422,
      );
    if (error instanceof AppError)
      return json({ error: error.message, code: error.code }, error.status);
    // Avoid logging request bodies, user tokens, or upstream error payloads.
    console.error(
      "TixWix request failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return json(
      {
        error: "Something went wrong. Please try again.",
        code: "INTERNAL_ERROR",
      },
      500,
    );
  }
}
export function mutationGuard(request: Request, allowBearer = true) {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new AppError(415, "Send an application/json request.");
  if (
    allowBearer &&
    /^Bearer \S+$/i.test(request.headers.get("authorization") ?? "")
  )
    return;
  const origin = request.headers.get("origin");
  if (
    origin !== appOrigin(request.url) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new AppError(
      403,
      "This request must come from TixWix.",
      "INVALID_ORIGIN",
    );
}
export async function body(request: Request): Promise<unknown> {
  const limit = 16384;
  if (Number(request.headers.get("content-length") ?? 0) > limit)
    throw new AppError(413, "This request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, "A JSON body is required.");
  let size = 0;
  let text = "";
  const decoder = new TextDecoder();
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new AppError(413, "This request is too large.");
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  text += decoder.decode();
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(400, "Send valid JSON.");
  }
}
