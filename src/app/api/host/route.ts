import { hostController } from "@/controllers/accounts";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return hostController(request);
}
