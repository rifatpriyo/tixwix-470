import { adminApplications } from "@/controllers/applications";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return adminApplications(request);
}
