import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { pageContext } from "@/services/context";
import { supabaseConfigured } from "@/lib/config";
export const metadata = { title: "Create account" };
export default async function Register() {
  if (await pageContext()) redirect("/dashboard");
  return (
    <div className="page grid gap-10 md:grid-cols-2 md:items-start">
      <div className="max-w-md pt-3">
        <p className="mb-5 text-sm font-medium text-primary">
          Welcome to TixWix
        </p>
        <h1 className="page-title">
          Good things
          <br />
          happen together.
        </h1>
        <p className="mt-5 text-muted-foreground">
          Start with a customer account. If you organize events, you can apply
          for host access from your dashboard.
        </p>
        <div className="mt-8 border-l-2 border-primary pl-5 text-sm text-muted-foreground">
          One account. Your own space.
          <br />A new way to bring people together.
        </div>
      </div>
      <section className="panel w-full max-w-lg">
        <h2 className="mb-6 text-2xl font-semibold">Create your account</h2>
        <AuthForm mode="register" configured={supabaseConfigured()} />
      </section>
    </div>
  );
}
