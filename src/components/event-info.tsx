/* eslint-disable @next/next/no-img-element -- Authenticated, uncached poster endpoint. */
import Link from "next/link";
import {
  bdt,
  dhakaDate,
  type EventDetail,
  type EventReview,
} from "@/lib/events";
export function EventPoster({ event }: { event: EventDetail }) {
  return event.poster ? (
    <img
      src={`/api/event-posters/${event.id}?v=${event.version}`}
      alt={`${event.title || "Event"} poster`}
      className="aspect-[16/10] w-full rounded-xl bg-secondary object-cover"
    />
  ) : (
    <div className="flex aspect-[16/10] items-center justify-center rounded-xl bg-secondary text-3xl font-semibold text-primary">
      TixWix Live
    </div>
  );
}
export function EventCards({ events }: { events: EventDetail[] }) {
  return events.length ? (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e) => (
        <Link
          key={e.id}
          href={`/events/${e.slug}`}
          className="panel block space-y-3 transition-shadow hover:shadow-md"
        >
          <EventPoster event={e} />
          <p className="text-sm capitalize text-primary">{e.category}</p>
          <h2 className="text-xl font-semibold">{e.title}</h2>
          <p>
            {e.venue?.name} · {e.venue?.city}
          </p>
          <p className="subtle">{dhakaDate(e.next_session)} (Dhaka)</p>
          <p className="font-semibold">From {bdt(e.starting_price)}</p>
        </Link>
      ))}
    </div>
  ) : (
    <div className="panel">
      <h2 className="text-xl font-semibold">No events found</h2>
      <p className="mt-2 text-muted-foreground">
        Try a different search or check back for newly published events.
      </p>
    </div>
  );
}
export function EventInfo({ event }: { event: EventDetail }) {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <EventPoster event={event} />
      <div className="space-y-6">
        <p className="capitalize text-primary">{event.category}</p>
        <h1 className="page-title">{event.title || "Untitled draft"}</h1>
        <p>Organized by {event.organizer_name}</p>
        <p className="whitespace-pre-wrap break-words">
          {event.description || "No description yet."}
        </p>
        <section>
          <h2 className="text-xl font-semibold">Venue</h2>
          <p>{event.venue?.name}</p>
          <p>
            {event.venue?.address}, {event.venue?.city}
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold">Sessions · Asia/Dhaka</h2>
          {event.sessions.map((s) => (
            <p key={s.id}>
              {dhakaDate(s.starts_at)} – {dhakaDate(s.ends_at)}
            </p>
          ))}
        </section>
        <section>
          <h2 className="text-xl font-semibold">Tickets</h2>
          {event.tickets.map((t) => (
            <p key={t.id}>
              {t.name || "Unnamed category"} · {bdt(t.price_minor)} · Capacity{" "}
              {t.capacity ?? "not set"}
            </p>
          ))}
        </section>
      </div>
    </div>
  );
}
export function EventHistory({ reviews }: { reviews: EventReview[] }) {
  return (
    <section className="panel mt-8">
      <h2 className="mb-4 text-xl font-semibold">Review history</h2>
      <ol className="space-y-4">
        {reviews.map((r) => (
          <li key={r.id}>
            <p className="font-medium capitalize">
              {r.previous_status?.replaceAll("_", " ") ?? "Created"} →{" "}
              {r.new_status.replaceAll("_", " ")}
            </p>
            <p className="subtle">
              {dhakaDate(r.created_at)} · Actor:{" "}
              {r.actor_id ?? "Deleted account"}
            </p>
            {r.feedback && (
              <p className="mt-1 whitespace-pre-wrap break-words">
                {r.feedback}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
