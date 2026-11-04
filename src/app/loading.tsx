export default function Loading() {
  return (
    <div className="page" role="status" aria-label="Loading page">
      <div className="mb-4 h-10 w-64 animate-pulse rounded bg-muted" />
      <div className="mb-10 h-5 w-72 max-w-full animate-pulse rounded bg-muted" />
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
      <span className="sr-only">Loading your page…</span>
    </div>
  );
}
