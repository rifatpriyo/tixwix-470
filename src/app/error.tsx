"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page">
      <section className="panel max-w-xl" role="alert">
        <h1 className="text-2xl font-semibold">We couldn’t load this page.</h1>
        <p className="my-5 text-muted-foreground">
          Your data may be temporarily unavailable. Try again in a moment.
        </p>
        <Button onClick={() => reset()}>Try again</Button>
      </section>
    </div>
  );
}
