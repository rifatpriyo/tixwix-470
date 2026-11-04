import Link from "next/link";
import { protectedPage } from "@/services/context";
import { ApplicationRepository } from "@/repositories/applications";
import { ApplicationService } from "@/services/applications";
import { ApplicationForm } from "@/components/application-form";
import {
  ApplicationInfo,
  ReviewHistory,
  Status,
} from "@/components/application-info";
import { buttonVariants } from "@/components/ui/button";
export const metadata = { title: "Host application" };
export default async function HostApplicationPage() {
  const { db, viewer } = await protectedPage();
  const { application, applications, reviews } = await new ApplicationService(
    new ApplicationRepository(db),
    viewer,
  ).own();
  const approved =
    viewer.roles.includes("host") || application?.status === "approved";
  return (
    <div className="page">
      <Link href="/dashboard" className="text-link text-sm">
        Back to my account
      </Link>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <h1 className="page-title">
          {approved ? "You’re an approved host." : "Become a host."}
        </h1>
        {application && <Status status={application.status} />}
      </div>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        {approved
          ? "Your organizer application has been approved. Your customer access stays with you."
          : "Tell us about your organization and the events you plan to bring to TixWix."}
      </p>
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1.65fr_1fr]">
        <section className="panel">
          {approved ? (
            <>
              <h2 className="mb-6 text-xl font-semibold">Approved organizer</h2>
              {application && <ApplicationInfo application={application} />}
              <Link href="/host" className={`${buttonVariants()} mt-6`}>
                Open host dashboard
              </Link>
            </>
          ) : application?.status === "pending" ? (
            <>
              <h2 className="mb-3 text-xl font-semibold">
                Your application is in review.
              </h2>
              <p className="mb-6 text-sm text-muted-foreground">
                You can check back here for a decision. A second application
                cannot be submitted while this one is pending.
              </p>
              <ApplicationInfo application={application} />
            </>
          ) : (
            <>
              {application?.status === "rejected" && (
                <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-5">
                  <h2 className="font-semibold">A few changes are needed</h2>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                    {application.feedback}
                  </p>
                </div>
              )}
              <h2 className="mb-6 text-xl font-semibold">
                {application ? "Update your details" : "Organizer details"}
              </h2>
              <ApplicationForm previous={application} email={viewer.email} />
            </>
          )}
        </section>
        <aside className="panel">
          <h2 className="mb-5 text-xl font-semibold">Review history</h2>
          <ReviewHistory reviews={reviews} applications={applications} />
          <p className="subtle mt-5 border-t pt-5">
            Previous decisions stay in your history when you submit a corrected
            application.
          </p>
        </aside>
      </div>
    </div>
  );
}
