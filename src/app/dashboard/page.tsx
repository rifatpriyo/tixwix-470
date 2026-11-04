import Link from "next/link";
import { protectedPage } from "@/services/context";
import { ApplicationRepository } from "@/repositories/applications";
import { Status, date } from "@/components/application-info";
import { buttonVariants } from "@/components/ui/button";
export const metadata = { title: "My account" };
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { viewer, accounts, db } = await protectedPage();
  const [profile, applications, params] = await Promise.all([
    accounts.profile(viewer.id),
    new ApplicationRepository(db).own(viewer.id),
    searchParams,
  ]);
  const latest = applications[0];
  return (
    <div className="page">
      <h1 className="page-title">
        Welcome, {profile.display_name || "friend"}.
      </h1>
      <p className="mt-3 text-muted-foreground">
        Your account and organizer journey, in one place.
      </p>
      {params.notice === "access" && (
        <p role="status" className="mt-6 rounded-lg border p-4 text-sm">
          That page requires additional permissions. You can view your current
          access below.
        </p>
      )}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="panel">
          <h2 className="mb-6 text-xl font-semibold">Account details</h2>
          <dl className="space-y-5">
            <div>
              <dt className="subtle">Name</dt>
              <dd className="mt-1 font-medium">{profile.display_name}</dd>
            </div>
            <div>
              <dt className="subtle">Email</dt>
              <dd className="mt-1 break-all font-medium">{viewer.email}</dd>
            </div>
            <div>
              <dt className="subtle">Current access</dt>
              <dd className="mt-1 capitalize">{viewer.roles.join(" · ")}</dd>
            </div>
            <div>
              <dt className="subtle">Joined (Dhaka time)</dt>
              <dd className="mt-1">{date(profile.created_at)}</dd>
            </div>
          </dl>
        </section>
        <section className="panel">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Your host application</h2>
            {latest && <Status status={latest.status} />}
          </div>
          {latest ? (
            <>
              <p className="font-medium">{latest.organizer_name}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                {latest.status === "approved"
                  ? "You’re approved. Your host dashboard is ready, and you retain your customer access."
                  : latest.status === "rejected"
                    ? "Read the feedback, update your details, and submit a corrected application."
                    : "Your application is with our team. You can check its status here."}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">
              Have an experience to share? Apply to become a TixWix host.
            </p>
          )}
          <Link
            href="/dashboard/host-application"
            className={`${buttonVariants({ variant: "outline" })} mt-6`}
          >
            {latest ? "View application" : "Become a host"}
          </Link>
          {viewer.roles.includes("host") && (
            <Link href="/host" className="text-link mt-5 block text-sm">
              Open host dashboard
            </Link>
          )}
        </section>
      </div>
      {viewer.roles.includes("admin") && (
        <section className="mt-6 flex flex-wrap items-center justify-between gap-5 rounded-xl border bg-secondary p-6">
          <div>
            <h2 className="font-semibold">Administrator workspace</h2>
            <p className="subtle mt-1">
              Review organizers and record approval decisions.
            </p>
          </div>
          <Link href="/admin/host-applications" className={buttonVariants()}>
            Review applications
          </Link>
        </section>
      )}
    </div>
  );
}
