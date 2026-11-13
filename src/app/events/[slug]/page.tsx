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
      <p className="mt-8 rounded-lg bg-secondary p-5">
        Ticket booking will be available in a later release.
      </p>
    </div>
  );
}
