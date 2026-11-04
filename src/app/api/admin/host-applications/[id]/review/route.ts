import { reviewApplication } from "@/controllers/applications";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return reviewApplication(request, (await params).id);
}
