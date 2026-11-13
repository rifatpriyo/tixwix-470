import { notFound } from "next/navigation";
import { z } from "zod";
import { protectedPage } from "@/services/context";
import { EventRepository } from "@/repositories/events";
import { EventInfo, EventHistory } from "@/components/event-info";
import { EventReviewForm } from "@/components/event-review-form";
export default async function ReviewEvent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { db } = await protectedPage("admin");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const repo = new EventRepository(db);
  const event = await repo.find(id);
  if (!event) notFound();
  return (
    <div className="page">
      <p className="mb-6 font-medium capitalize">
        {event.status.replaceAll("_", " ")}
      </p>
      <EventInfo event={event} />
      {event.status === "pending_review" && (
        <EventReviewForm key={event.version} id={id} version={event.version} />
      )}
      <EventHistory reviews={await repo.history(id)} />
    </div>
  );
}
