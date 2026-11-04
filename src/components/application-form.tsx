"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { mutate, type ApiResult } from "@/lib/client-api";
import type { HostApplication } from "@/lib/domain";
export function ApplicationForm({
  previous,
  email,
}: {
  previous?: HostApplication | null;
  email: string;
}) {
  const [result, setResult] = useState<ApiResult>({});
  const [pending, setPending] = useState(false);
  const locked = useRef(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setResult({});
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await mutate("/api/host-applications", data);
      setResult(response);
      if (!response.error) {
        router.refresh();
        setResult({
          message:
            "Application submitted. Your review status will appear here.",
        });
      }
    } catch {
      setResult({
        error:
          "Unable to connect. Check your application status before retrying.",
      });
    } finally {
      locked.current = false;
      setPending(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="space-y-5"
      noValidate
      aria-busy={pending}
    >
      <Field
        name="organizer_name"
        label="Organizer or organization name"
        autoComplete="organization"
        required
        maxLength={120}
        defaultValue={previous?.organizer_name}
        error={result.fields?.organizer_name}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          name="contact_email"
          label="Contact email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          defaultValue={previous?.contact_email ?? email}
          error={result.fields?.contact_email}
        />
        <Field
          name="contact_phone"
          label="Contact phone"
          type="tel"
          autoComplete="tel"
          required
          maxLength={25}
          defaultValue={previous?.contact_phone}
          error={result.fields?.contact_phone}
          hint="Include your country code, e.g. +880."
        />
      </div>
      <Field
        name="description"
        label="About your organization and events"
        multiline
        required
        maxLength={2000}
        defaultValue={previous?.description}
        error={result.fields?.description}
        hint="Describe who you are and the events you plan to organize. 30 to 2,000 characters."
      />
      {result.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-destructive"
        >
          {result.error}
        </p>
      )}
      {result.message && (
        <p role="status" className="text-sm text-primary">
          {result.message}
        </p>
      )}
      <div className="border-t pt-5">
        <Button type="submit" disabled={pending || !!result.message}>
          {pending
            ? "Submitting…"
            : previous
              ? "Resubmit application"
              : "Submit application"}
        </Button>
        <p className="subtle mt-3">
          Your details are shared with TixWix administrators for review.
        </p>
      </div>
    </form>
  );
}
