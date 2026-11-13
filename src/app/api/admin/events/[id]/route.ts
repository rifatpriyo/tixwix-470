import { getEvent } from "@/controllers/events";
export const runtime = "nodejs";
export async function GET(r: Request, c: { params: Promise<{ id: string }> }) {
  return getEvent(r, (await c.params).id, true);
}
