import { reservation } from "@/controllers/reservations";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return reservation(request, (await params).id, true);
}
