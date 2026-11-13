import Link from "next/link";
import { EventRepository } from "@/repositories/events";
import { dhakaDate, type EventStatus } from "@/lib/events";
export async function ManagedEvents({
  repository,
  hostId,
  status = "all",
  page = 1,
}: {
  repository: EventRepository;
  hostId: string | null;
  status?: EventStatus | "all";
  page?: number;
}) {
  const result = await repository.list(hostId, status, page);
  const rows = await Promise.all(
    result.events.map(async (event) => ({
      event,
      reviews: await repository.history(event.id),
    })),
  );
  const href = (n: number) =>
    `${hostId ? "/host" : "/admin/events"}?status=${status}&page=${n}`;
  return (
    <div className="mt-6 space-y-4">
      {rows.length ? (
        rows.map(({ event, reviews }) => (
          <article key={event.id} className="panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">
                {event.title || "Untitled draft"}
              </h2>
              <span className="rounded-full bg-secondary px-3 py-1 text-sm capitalize">
                {event.status.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-2 subtle">
              Next session: {dhakaDate(event.next_session)} (Dhaka)
            </p>
            {reviews.find((r) => r.feedback)?.feedback && (
              <p className="mt-3 whitespace-pre-wrap">
                Review feedback: {reviews.find((r) => r.feedback)!.feedback}
              </p>
            )}
            <Link
              className="text-link mt-4 inline-block"
              href={`${hostId ? "/host" : "/admin"}/events/${event.id}`}
            >
              {hostId
                ? event.status === "pending_review"
                  ? "View submission"
                  : "Edit event"
                : "Review event"}
            </Link>
          </article>
        ))
      ) : (
        <p className="panel">
          {hostId
            ? "No events yet. Create your first draft to get started."
            : "No events with this status."}
        </p>
      )}
      <nav aria-label="Event list pagination" className="flex gap-5">
        {page > 1 && (
          <Link href={href(page - 1)} className="text-link">
            Previous
          </Link>
        )}
        <span>
          Page {page} · {result.total} events
        </span>
        {page * 20 < result.total && (
          <Link href={href(page + 1)} className="text-link">
            Next
          </Link>
        )}
      </nav>
    </div>
  );
}
