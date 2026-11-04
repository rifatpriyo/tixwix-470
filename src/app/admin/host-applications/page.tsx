import Link from "next/link";
import { protectedPage } from "@/services/context";
import { ApplicationRepository } from "@/repositories/applications";
import { ApplicationService } from "@/services/applications";
import { filterSchema, pageSchema } from "@/lib/validation";
import { Status, date } from "@/components/application-info";
import { buttonVariants } from "@/components/ui/button";
export const metadata = { title: "Review host applications" };
export default async function AdminApplications({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { db, viewer } = await protectedPage("admin");
  const params = await searchParams;
  const filter = filterSchema.safeParse(params.status ?? "pending");
  const status = filter.success ? filter.data : "pending";
  const parsedPage = pageSchema.safeParse(params.page ?? 1);
  const page = parsedPage.success ? parsedPage.data : 1;
  const { applications, total, pageSize } = await new ApplicationService(
    new ApplicationRepository(db),
    viewer,
  ).list(status, page);
  return (
    <div className="page">
      <h1 className="page-title">Host applications</h1>
      <p className="mt-3 text-muted-foreground">
        Review the people behind the next great experiences.
      </p>
      <nav
        aria-label="Filter applications by status"
        className="my-8 flex flex-wrap gap-2"
      >
        {["pending", "approved", "rejected", "all"].map((value) => (
          <Link
            key={value}
            aria-current={status === value ? "page" : undefined}
            href={`?status=${value}`}
            className={`${buttonVariants({ variant: status === value ? "default" : "outline", size: "sm" })} capitalize`}
          >
            {value}
          </Link>
        ))}
      </nav>
      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b px-6 py-4 text-sm text-muted-foreground">
          {total} {total === 1 ? "application" : "applications"} ·{" "}
          {status === "all" ? "All statuses" : status}
        </div>
        {applications.length ? (
          <ul className="divide-y">
            {applications.map((app) => (
              <li key={app.id}>
                <Link
                  href={`/admin/host-applications/${app.id}`}
                  className="flex flex-wrap items-center justify-between gap-4 p-6 transition-colors hover:bg-muted"
                >
                  <div className="min-w-0">
                    <h2 className="break-words font-semibold">
                      {app.organizer_name}
                    </h2>
                    <p className="subtle mt-1 break-all">{app.contact_email}</p>
                    <p className="subtle mt-2">
                      Submitted {date(app.created_at)} · Dhaka
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Status status={app.status} />
                    <span className="text-sm font-medium text-primary">
                      Review →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-6 py-16 text-center">
            <h2 className="text-xl font-semibold">No applications here yet.</h2>
            <p className="subtle mt-2">
              Applications matching this filter will appear here.
            </p>
          </div>
        )}
      </section>
      <div className="mt-5 flex items-center justify-between text-sm">
        {page > 1 ? (
          <Link
            className="text-link"
            href={`?status=${status}&page=${page - 1}`}
          >
            Previous page
          </Link>
        ) : (
          <span />
        )}
        <span>Page {page}</span>
        {page * pageSize < total ? (
          <Link
            className="text-link"
            href={`?status=${status}&page=${page + 1}`}
          >
            Next page
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
