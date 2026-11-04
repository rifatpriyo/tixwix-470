import type { ApplicationStatus, HostApplication, Review } from "@/lib/domain";
import { Badge } from "@/components/ui/badge";
export function Status({ status }: { status: ApplicationStatus }) {
  return (
    <Badge
      variant="outline"
      className={
        status === "approved"
          ? "border-primary/30 bg-secondary text-primary"
          : status === "rejected"
            ? "border-red-200 bg-red-50 text-red-800"
            : "bg-muted text-foreground"
      }
    >
      {status === "pending"
        ? "Awaiting review"
        : status === "approved"
          ? "Approved"
          : "Changes requested"}
    </Badge>
  );
}
export function date(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  }).format(new Date(value));
}
export function ApplicationInfo({
  application,
}: {
  application: HostApplication;
}) {
  return (
    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
      {[
        ["Organizer", application.organizer_name],
        ["Submitted (Dhaka time)", date(application.created_at)],
        ["Contact email", application.contact_email],
        ["Contact phone", application.contact_phone],
      ].map(([label, value]) => (
        <div key={label}>
          <dt className="subtle">{label}</dt>
          <dd className="mt-1 break-words font-medium">{value}</dd>
        </div>
      ))}
      <div className="sm:col-span-2">
        <dt className="subtle">About the organizer and events</dt>
        <dd className="mt-1 whitespace-pre-wrap break-words leading-relaxed">
          {application.description}
        </dd>
      </div>
    </dl>
  );
}
export function ReviewHistory({
  reviews,
  applications,
  showReviewer = false,
}: {
  reviews: Review[];
  applications: HostApplication[];
  showReviewer?: boolean;
}) {
  if (!reviews.length)
    return <p className="subtle">No review decisions yet.</p>;
  return (
    <ol className="divide-y">
      {reviews.map((review) => (
        <li key={review.id} className="space-y-3 py-5 first:pt-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Status status={review.decision} />
            <time className="subtle" dateTime={review.created_at}>
              {date(review.created_at)} · Dhaka
            </time>
          </div>
          <p className="text-sm font-medium">
            {applications.find((a) => a.id === review.application_id)
              ?.organizer_name ?? "Application"}
          </p>
          {review.feedback && (
            <p className="whitespace-pre-wrap break-words text-sm">
              {review.feedback}
            </p>
          )}
          {showReviewer && (
            <p className="subtle break-all">
              Reviewer ID: {review.reviewer_id ?? "Deleted account"}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
