import { listEvents } from "@/controllers/events";
export const runtime = "nodejs";
export function GET(r: Request) {
  return listEvents(r, true);
}
