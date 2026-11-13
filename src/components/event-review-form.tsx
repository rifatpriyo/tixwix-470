"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
export function EventReviewForm({
  id,
  version,
}: {
  id: string;
  version: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  return (
    <form
      className="panel mt-8"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const action = (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
          "value",
        );
        setBusy(true);
        setErrors({});
        try {
          const response = await fetch(`/api/admin/events/${id}/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              version,
              action,
              feedback: form.get("feedback"),
            }),
          });
          const result = await response.json();
          if (!response.ok) {
            setErrors(result.fields ?? {});
            setMessage(result.error);
          } else {
            setMessage("Decision saved.");
            router.refresh();
          }
        } catch {
          setMessage("Could not save the decision. Try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="mb-4 text-xl font-semibold">Review decision</h2>
      <Field
        label="Feedback"
        name="feedback"
        multiline
        maxLength={2000}
        error={errors.feedback}
        hint="Required when requesting changes."
        disabled={busy}
      />
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="submit"
          value="request_changes"
          variant="outline"
          disabled={busy}
        >
          Request changes
        </Button>
        <Button type="submit" value="publish" disabled={busy}>
          Approve and publish
        </Button>
      </div>
      <p role="status" className="mt-4">
        {message}
      </p>
    </form>
  );
}
