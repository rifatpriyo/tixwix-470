import { reservation } from "@/controllers/reservations";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return reservation(request, (await params).id);
}
