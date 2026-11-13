import Link from "next/link";
export default function UnavailableEvent() {
  return (
    <div className="page">
      <h1 className="page-title">Event unavailable</h1>
      <p className="my-5 text-muted-foreground">
        This event is not currently published. Explore other upcoming
        experiences.
      </p>
      <Link href="/events" className="text-link">
        Back to events
      </Link>
    </div>
  );
}
