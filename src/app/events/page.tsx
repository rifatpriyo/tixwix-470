import Link from "next/link";
import { categories, catalogueSchema } from "@/lib/events";
import { publicEvents } from "@/services/events";
import { supabaseConfigured } from "@/lib/config";
import { EventCards } from "@/components/event-info";
import { Field } from "@/components/field";
export const dynamic = "force-dynamic";
export const metadata = { title: "Explore events" };
export default async function Events({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const parsed = catalogueSchema.safeParse(params);
  const filters = parsed.success ? parsed.data : catalogueSchema.parse({});
  let result = {
    events: [] as Awaited<
      ReturnType<ReturnType<typeof publicEvents>["catalogue"]>
    >["events"],
    total: 0,
    page: filters.page,
    pageSize: 12,
  };
  let error = !parsed.success
    ? "Check your filters: use a valid date, category and page number."
    : "";
  if (parsed.success && supabaseConfigured()) {
    try {
      result = await publicEvents().catalogue(filters);
    } catch {
      error =
        "The event catalogue is temporarily unavailable. Please try again.";
    }
  } else if (!supabaseConfigured())
    error = "The event catalogue is not connected yet.";
  const pageLink = (page: number) =>
    `/events?${new URLSearchParams({ ...filters, page: String(page) })}`;
  return (
    <div className="page">
      <p className="mb-3 text-sm uppercase tracking-widest text-primary">
        Find your next experience
      </p>
      <h1 className="page-title">Explore events</h1>
      <form className="panel my-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          name="q"
          label="Search by title"
          defaultValue={params.q ?? ""}
          maxLength={160}
        />
        <div>
          <label htmlFor="category" className="mb-2 block text-sm font-medium">
            Category
          </label>
          <select
            id="category"
            name="category"
            defaultValue={params.category ?? ""}
            className="h-11 w-full rounded-md border bg-white px-3"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <Field
          name="location"
          label="Location (city)"
          defaultValue={params.location ?? ""}
          maxLength={100}
        />
        <Field
          name="date"
          label="Date (Asia/Dhaka)"
          type="date"
          defaultValue={params.date ?? ""}
        />
        <div className="flex items-center gap-4 sm:col-span-2 lg:col-span-4">
          <button className="rounded-md bg-primary px-5 py-3 text-white">
            Search events
          </button>
          <Link href="/events" className="text-link">
            Clear filters
          </Link>
        </div>
      </form>
      {error ? (
        <p role="alert" className="panel">
          {error}
        </p>
      ) : (
        <>
          <p className="mb-5 subtle">
            {result.total} events · Upcoming sessions first · Times in Dhaka
          </p>
          <EventCards events={result.events} />
          <nav aria-label="Catalogue pagination" className="mt-8 flex gap-6">
            {filters.page > 1 && (
              <Link href={pageLink(filters.page - 1)} className="text-link">
                Previous
              </Link>
            )}
            <span>Page {filters.page}</span>
            {filters.page * 12 < result.total && (
              <Link href={pageLink(filters.page + 1)} className="text-link">
                Next
              </Link>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
