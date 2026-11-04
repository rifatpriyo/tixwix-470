import { applicationDetail } from "@/controllers/applications";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return applicationDetail(request, (await params).id);
}
