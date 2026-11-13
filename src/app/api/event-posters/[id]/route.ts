import { posterImage } from "@/controllers/events";
export const runtime = "nodejs";
export async function GET(r: Request, c: { params: Promise<{ id: string }> }) {
  return posterImage(r, (await c.params).id);
}
