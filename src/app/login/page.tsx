import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { pageContext } from "@/services/context";
import { supabaseConfigured } from "@/lib/config";
export const metadata = { title: "Sign in" };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await pageContext()) redirect("/dashboard");
  const { error } = await searchParams;
  return (
    <div className="page grid gap-10 md:grid-cols-2">
      <div className="max-w-md pt-3">
        <p className="mb-5 text-sm font-medium text-primary">Welcome back</p>
        <h1 className="page-title">
          Your people.
          <br />
          Your experiences.
        </h1>
        <p className="mt-5 text-muted-foreground">
          Sign in to manage your account, follow your host application, or
          review organizer submissions.
        </p>
      </div>
      <section className="panel w-full max-w-lg">
        <h2 className="mb-6 text-2xl font-semibold">Sign in to TixWix</h2>
        {error && (
          <p
            role="alert"
            className="mb-5 rounded-lg bg-red-50 p-4 text-sm text-destructive"
          >
            {error === "setup"
              ? "Account services need to be configured before this link can be used."
              : "This confirmation link is invalid or has expired. If you have already confirmed your email, sign in. Otherwise, ask the project administrator for a new confirmation link."}
          </p>
        )}
        <AuthForm mode="login" configured={supabaseConfigured()} />
      </section>
    </div>
  );
}
