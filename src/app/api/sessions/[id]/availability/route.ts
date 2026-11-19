import { availability } from "@/controllers/reservations";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return availability((await params).id);
}
