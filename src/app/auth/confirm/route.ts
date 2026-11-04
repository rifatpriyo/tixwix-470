import { authCallback } from "@/controllers/callback";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return authCallback(request, true);
}
