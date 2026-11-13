import { getEvent, saveEvent } from "@/controllers/events";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(r: Request, c: Context) {
  return getEvent(r, (await c.params).id);
}
export async function PUT(r: Request, c: Context) {
  return saveEvent(r, (await c.params).id);
}
