import { assignSeating } from "@/controllers/reservations";
export const runtime = "nodejs";
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return assignSeating(request, (await params).id);
}
