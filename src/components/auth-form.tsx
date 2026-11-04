"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { mutate, type ApiResult } from "@/lib/client-api";

export function AuthForm({
  mode,
  configured,
}: {
  mode: "register" | "login";
  configured: boolean;
}) {
  const [result, setResult] = useState<ApiResult>({});
  const [pending, setPending] = useState(false);
  const locked = useRef(false);
  const register = mode === "register";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setResult({});
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await mutate(`/api/auth/${mode}`, data);
      if (response.redirect) {
        window.location.assign(response.redirect);
        return;
      }
      setResult(response);
    } catch {
      setResult({
        error: "Unable to connect. Check your connection and try again.",
      });
    } finally {
      locked.current = false;
      setPending(false);
    }
  }
  if (result.message)
    return (
      <div className="space-y-6">
        <div
          role="status"
          className="rounded-lg border border-primary/30 bg-secondary p-5"
        >
          <h2 className="mb-2 text-xl font-semibold">Check your inbox</h2>
          <p>{result.message}</p>
        </div>
        <Link href="/login" className="text-link">
          Back to sign in
        </Link>
      </div>
    );
  return (
    <form
      onSubmit={submit}
      className="space-y-5"
      aria-busy={pending}
      noValidate
    >
      {!configured && (
        <p role="status" className="rounded-lg border bg-muted p-4 text-sm">
          Account services are awaiting setup. Registration and sign in will be
          available once Supabase is connected.
        </p>
      )}
      {register && (
        <Field
          name="display_name"
          label="Your name"
          autoComplete="name"
          required
          maxLength={100}
          error={result.fields?.display_name}
        />
      )}
      <Field
        name="email"
        label="Email address"
        type="email"
        autoComplete="email"
        required
        maxLength={254}
        error={result.fields?.email}
      />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete={register ? "new-password" : "current-password"}
        required
        maxLength={128}
        error={result.fields?.password}
        hint={
          register ? "At least 8 characters. Use a unique password." : undefined
        }
      />
      {result.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-destructive"
        >
          {result.error}
        </p>
      )}
      <Button
        type="submit"
        className="h-11 w-full"
        disabled={pending || !configured}
      >
        {pending
          ? register
            ? "Creating account…"
            : "Signing in…"
          : register
            ? "Create account"
            : "Sign in"}
      </Button>
      <p className="subtle text-center">
        {register ? "Already have an account? " : "New to TixWix? "}
        <Link className="text-link" href={register ? "/login" : "/register"}>
          {register ? "Sign in" : "Create account"}
        </Link>
      </p>
    </form>
  );
}
