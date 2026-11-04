import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, CheckCircledIcon } from "@radix-ui/react-icons";
import { buttonVariants } from "@/components/ui/button";
import { pageContext } from "@/services/context";

export default async function Home() {
  const context = await pageContext();
  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8">
      <section className="grid items-center gap-10 py-10 md:grid-cols-[1.15fr_1fr] md:gap-14 md:py-14">
        <div>
          <p className="mb-6 text-xs font-semibold uppercase tracking-[.18em] text-primary">
            For the moments that bring us together
          </p>
          <h1 className="text-5xl font-semibold leading-[1.07] tracking-[-.055em] sm:text-6xl lg:text-7xl">
            Be part of
            <br />
            something live.
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted-foreground">
            Your next great experience starts with a connection. Create your
            account, or bring people together as a host.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={context ? "/dashboard" : "/register"}
              className={buttonVariants({ size: "lg" })}
            >
              {context ? "My account" : "Create account"}
              <ArrowRightIcon />
            </Link>
            <Link
              href="/dashboard/host-application"
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              Become a host
            </Link>
          </div>
        </div>
        <div className="relative aspect-[4/4.4] overflow-hidden rounded-2xl bg-[#102c26]">
          <Image
            src="/concert.png"
            alt="A concert audience gathered under teal stage lights"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 480px"
            className="object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-7 pt-20">
            <p className="text-2xl font-medium text-white">
              A little closer.
              <br />A lot more together.
            </p>
          </div>
        </div>
      </section>
      <section className="grid gap-8 border-t py-12 md:grid-cols-[1fr_1.5fr]">
        <div>
          <h2 className="text-2xl font-semibold">
            Great experiences
            <br />
            start with good hosts.
          </h2>
          <p className="mt-3 max-w-sm text-muted-foreground">
            Organizer applications are open. Tell us what you have in mind, and
            our team will review your details.
          </p>
        </div>
        <ol className="space-y-6">
          {[
            [
              "01",
              "Make yourself at home",
              "Create one account for your customer and host access.",
            ],
            [
              "02",
              "Tell us about your events",
              "Share your organizer details and the experiences you want to create.",
            ],
            [
              "03",
              "Get approved to host",
              "Track your review, read feedback, and access your host dashboard after approval.",
            ],
          ].map(([n, title, text]) => (
            <li key={n} className="flex gap-5">
              <span className="pt-1 text-sm font-medium text-primary">{n}</span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <div className="mb-10 flex items-start gap-3 rounded-xl bg-secondary p-5 text-sm">
        <CheckCircledIcon
          className="mt-0.5 shrink-0 text-primary"
          width={20}
          height={20}
        />
        <p>
          We’re starting with accounts and organizer onboarding. Event listings
          and ticket booking are coming in a later release.
        </p>
      </div>
    </div>
  );
}
