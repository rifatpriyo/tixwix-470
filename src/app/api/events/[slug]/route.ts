import { publicDetail } from "@/controllers/events";
export const runtime = "nodejs";
export async function GET(
  r: Request,
  c: { params: Promise<{ slug: string }> },
) {
  return publicDetail((await c.params).slug);
}
