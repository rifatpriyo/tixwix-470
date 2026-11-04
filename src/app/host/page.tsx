import Link from "next/link";
import { protectedPage } from "@/services/context";
import { date } from "@/components/application-info";
import { Badge } from "@/components/ui/badge";
export const metadata = { title: "Host dashboard" };
export default async function HostDashboard() {
  const { accounts, viewer } = await protectedPage("host");
  const host = await accounts.host(viewer.id);
  return (
    <div className="page">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="page-title">Host dashboard</h1>
        <Badge variant="outline" className="text-primary">
          Approved host
        </Badge>
      </div>
      <p className="mt-3 text-muted-foreground">
        Welcome to your organizer workspace.
      </p>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="panel">
          <h2 className="mb-6 text-xl font-semibold">
            {host?.organizer_name ?? "Organizer account"}
          </h2>
          {host ? (
            <dl className="space-y-4">
              <div>
                <dt className="subtle">Contact email</dt>
                <dd className="break-all">{host.contact_email}</dd>
              </div>
              <div>
                <dt className="subtle">Phone</dt>
                <dd>{host.contact_phone}</dd>
              </div>
              <div>
                <dt className="subtle">Approved (Dhaka time)</dt>
                <dd>{date(host.approved_at)}</dd>
              </div>
              <div>
                <dt className="subtle">About your organization</dt>
                <dd className="whitespace-pre-wrap break-words">
                  {host.description}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm">
              Your organizer details are unavailable. Please contact the project
              administrator.
            </p>
          )}
        </section>
        <section className="panel bg-secondary">
          <h2 className="text-xl font-semibold">
            You’re ready for what’s next.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Your host access is active. Event creation and management will
            become available in a later release.
          </p>
          <p className="mt-4 text-sm">
            You can continue using your customer account with the same sign-in.
          </p>
          <Link
            href="/dashboard/host-application"
            className="text-link mt-6 inline-block text-sm"
          >
            View your approval
          </Link>
        </section>
      </div>
    </div>
  );
}
