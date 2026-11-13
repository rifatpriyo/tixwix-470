import { notFound } from "next/navigation";
import { protectedPage } from "@/services/context";
import { EventRepository } from "@/repositories/events";
import { EventEditor } from "@/components/event-editor";
import { EventHistory, EventPoster } from "@/components/event-info";
import { z } from "zod";
export default async function EditEvent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { db, viewer } = await protectedPage("host");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const repo = new EventRepository(db);
  const event = await repo.find(id);
  if (!event || event.host_id !== viewer.id) notFound();
  return (
    <div className="page">
      <h1 className="page-title">Edit event</h1>
      {event.poster && (
        <div className="mt-6 max-w-md">
          <EventPoster event={event} />
        </div>
      )}
      <EventEditor key={event.id} event={event} />
      <EventHistory reviews={await repo.history(id)} />
    </div>
  );
}
