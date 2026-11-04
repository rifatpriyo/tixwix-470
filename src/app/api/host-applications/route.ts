import { ownApplications, submitApplication } from "@/controllers/applications";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return ownApplications(request);
}
export async function POST(request: Request) {
  return submitApplication(request);
}
