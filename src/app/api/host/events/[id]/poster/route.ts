import { uploadPoster } from "@/controllers/events";
export const runtime = "nodejs";
export async function POST(r: Request, c: { params: Promise<{ id: string }> }) {
  return uploadPoster(r, (await c.params).id);
}
