import { transitionEvent } from "@/controllers/events";
export const runtime = "nodejs";
export async function POST(r: Request, c: { params: Promise<{ id: string }> }) {
  return transitionEvent(r, (await c.params).id);
}
