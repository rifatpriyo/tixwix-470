import Link from "next/link";
import { notFound } from "next/navigation";
import { protectedPage } from "@/services/context";
import { ApplicationRepository } from "@/repositories/applications";
import { ApplicationService } from "@/services/applications";
import { uuidSchema } from "@/lib/validation";
import { AppError } from "@/lib/errors";
import {
  ApplicationInfo,
  ReviewHistory,
  Status,
} from "@/components/application-info";
import { ReviewForm } from "@/components/review-form";
export const metadata = { title: "Application details" };
export default async function AdminDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { db, viewer } = await protectedPage("admin");
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const service = new ApplicationService(new ApplicationRepository(db), viewer);
  const detail = await service.detail(id).catch((error) => {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  });
  const { application, applications, reviews } = detail;
  return (
    <div className="page">
      <Link href="/admin/host-applications" className="text-link text-sm">
        Back to applications
      </Link>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <h1 className="page-title break-words">{application.organizer_name}</h1>
        <Status status={application.status} />
      </div>
      <p className="subtle mt-3 break-all">
        Applicant ID: {application.applicant_id}
      </p>
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <section className="panel">
            <h2 className="mb-6 text-xl font-semibold">Application details</h2>
            <ApplicationInfo application={application} />
          </section>
          <section className="panel">
            <h2 className="mb-5 text-xl font-semibold">
              {application.status === "pending"
                ? "Record your decision"
                : "Review complete"}
            </h2>
            {application.status === "pending" ? (
              <ReviewForm id={id} />
            ) : (
              <p className="text-sm text-muted-foreground">
                This application has already been reviewed. Its original
                decision is preserved in the review history.
              </p>
            )}
          </section>
        </div>
        <aside className="panel">
          <h2 className="mb-5 text-xl font-semibold">
            Applicant review history
          </h2>
          <ReviewHistory
            reviews={reviews}
            applications={applications}
            showReviewer
          />
          {applications.length > 1 && (
            <div className="mt-5 border-t pt-5">
              <h3 className="mb-3 text-sm font-semibold">All submissions</h3>
              <ul className="space-y-3">
                {applications.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/admin/host-applications/${a.id}`}
                      className="text-link text-sm"
                    >
                      {a.organizer_name} · {a.status}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
