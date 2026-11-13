export const runtime = "nodejs";
import { listEvents, saveEvent } from "@/controllers/events";
export function GET(request: Request) {
  return listEvents(request);
}
export function POST(request: Request) {
  return saveEvent(request);
}
