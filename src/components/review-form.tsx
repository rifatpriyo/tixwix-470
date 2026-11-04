"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { mutate, type ApiResult } from "@/lib/client-api";
export function ReviewForm({ id }: { id: string }) {
  const [decision, setDecision] = useState("approved");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ApiResult>({});
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
      const response = await mutate(
        `/api/admin/host-applications/${id}/review`,
        data,
      );
      setResult(response);
      if (!response.error) {
        setResult({ message: "Decision recorded." });
        router.refresh();
      }
    } catch {
      setResult({
        error:
          "Unable to connect. Refresh to check whether your decision was recorded.",
      });
    } finally {
      locked.current = false;
      setPending(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      noValidate
      aria-busy={pending}
      className="space-y-5"
    >
      <fieldset disabled={pending}>
        <legend className="mb-3 text-sm font-medium">Review decision</legend>
        <div className="flex flex-wrap gap-6">
          {[
            ["approved", "Approve host access"],
            ["rejected", "Request changes"],
          ].map(([value, label]) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name="decision"
                value={value}
                checked={decision === value}
                onChange={() => setDecision(value)}
                className="accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field
        name="feedback"
        label={
          decision === "rejected"
            ? "Explanation (required)"
            : "Feedback (optional)"
        }
        multiline
        required={decision === "rejected"}
        maxLength={2000}
        hint="The applicant can read this feedback."
        error={result.fields?.feedback}
      />
      <p className="subtle">
        {decision === "approved"
          ? "Approval immediately grants host access. This decision cannot be changed from this screen."
          : "The customer keeps their account and can submit a corrected application."}
      </p>
      {result.error && (
        <p role="alert" className="text-sm text-destructive">
          {result.error}
        </p>
      )}
      {result.message && (
        <p role="status" className="text-sm text-primary">
          {result.message}
        </p>
      )}
      <Button type="submit" disabled={pending || !!result.message}>
        {pending
          ? "Saving decision…"
          : decision === "approved"
            ? "Approve application"
            : "Reject with feedback"}
      </Button>
    </form>
  );
}
