import { authController } from "@/controllers/auth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return authController(request, "login");
}
