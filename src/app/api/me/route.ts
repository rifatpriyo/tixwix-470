import { accountController } from "@/controllers/accounts";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return accountController(request);
}
export async function PATCH(request: Request) {
  return accountController(request, true);
}
