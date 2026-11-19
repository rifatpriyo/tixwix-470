import { SeatBooking } from "@/components/seat-booking";
import { notFound } from "next/navigation";
import { publicEvents } from "@/services/events";
import { EventInfo } from "@/components/event-info";
import { supabaseConfigured } from "@/lib/config";
export const dynamic = "force-dynamic";
export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!supabaseConfigured()) notFound();
  const event = await publicEvents().find((await params).slug, true);
  if (!event) notFound();
  return (
    <div className="page">
      <EventInfo event={event} />
      <SeatBooking event={event} />
    </div>
  );
}
