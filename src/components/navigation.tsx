import Link from "next/link";
import { IdCardIcon } from "@radix-ui/react-icons";
import { pageContext } from "@/services/context";
import { Logout } from "@/components/logout";
import { buttonVariants } from "@/components/ui/button";
export async function Navigation() {
  const context = await pageContext();
  const viewer = context?.viewer;
  return (
    <header className="border-b bg-white">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex min-h-18 max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8"
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-2xl font-bold tracking-tighter"
        >
          <span className="rounded-md bg-primary p-2 text-white">
            <IdCardIcon width={22} height={22} />
          </span>
          TixWix<span className="text-primary">.</span>
        </Link>
        <div className="flex flex-wrap items-center gap-3 text-sm sm:gap-6">
          {viewer ? (
            <>
              <Link href="/dashboard" className="hover:text-primary">
                My account
              </Link>
              <Link
                href="/dashboard/host-application"
                className="hover:text-primary"
              >
                Host application
              </Link>
              {viewer.roles.includes("host") && (
                <Link href="/host" className="hover:text-primary">
                  Host dashboard
                </Link>
              )}
              {viewer.roles.includes("admin") && (
                <Link
                  href="/admin/host-applications"
                  className="hover:text-primary"
                >
                  Review applications
                </Link>
              )}
              <Logout />
            </>
          ) : (
            <>
              <Link href="/login" className="font-medium">
                Sign in
              </Link>
              <Link href="/register" className={buttonVariants({ size: "sm" })}>
                Create account
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
