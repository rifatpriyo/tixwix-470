"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import {
  categories,
  eventInput,
  type EventDetail,
  type EventRecord,
} from "@/lib/events";
type Result = {
  error?: string;
  fields?: Record<string, string[]>;
  event?: EventRecord;
  path?: string;
};
export function EventEditor({ event }: { event?: EventDetail }) {
  const router = useRouter();
  const [record, setRecord] = useState(event);
  const [poster, setPoster] = useState(event?.poster ?? null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const initial = event ? eventInput(event) : undefined;
  async function send(path: string, data: unknown, method = "POST") {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result: Result = await response.json();
    if (!response.ok) {
      setErrors(result.fields ?? {});
      throw new Error(result.error ?? "Request failed.");
    }
    return result;
  }
  async function save(form: HTMLFormElement) {
    setBusy(true);
    setMessage("");
    setErrors({});
    try {
      const data = Object.fromEntries(new FormData(form));
      const result = await send(
        record ? `/api/host/events/${record.id}` : "/api/host/events",
        { version: record?.version ?? null, data, poster },
        record ? "PUT" : "POST",
      );
      if (result.event) {
        setDirty(false);
        setRecord({ ...record, ...result.event } as EventDetail);
        setMessage("Draft saved. Submit separately when you are ready.");
        if (!record) {
          router.replace(`/host/events/${result.event.id}`);
        }
        router.refresh();
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!record) return;
    setBusy(true);
    setMessage("");
    setErrors({});
    try {
      const result = await send(`/api/host/events/${record.id}/submit`, {
        version: record.version,
        action: "submit",
      });
      setRecord({ ...record, ...result.event });
      setMessage("Submitted. Your event is read-only while it is reviewed.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not submit.");
    } finally {
      setBusy(false);
    }
  }
  const locked = record?.status === "pending_review";
  return (
    <div className="panel mt-8">
      <p className="mb-4 font-medium capitalize">
        Status: {record?.status.replaceAll("_", " ") ?? "New draft"}
      </p>
      {record?.status === "published" && (
        <p className="mb-6 rounded-lg bg-amber-50 p-4 text-amber-950">
          Saving any changes, including the poster, schedule or price, returns
          this event to draft and removes it from public pages until approved
          again. Opening this editor does not withdraw it.
        </p>
      )}
      {locked && (
        <p className="mb-6">
          Your submission is being reviewed. Editing is paused until the
          administrator decides.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(e.currentTarget);
        }}
        onChange={() => {
          setMessage("");
          setDirty(true);
        }}
      >
        <fieldset
          disabled={busy || locked}
          className="grid gap-5 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <Field
              name="title"
              label="Event title"
              defaultValue={initial?.title ?? ""}
              maxLength={160}
              error={errors.title}
            />
          </div>
          <div className="sm:col-span-2">
            <Field
              name="description"
              label="Description"
              multiline
              defaultValue={initial?.description ?? ""}
              maxLength={8000}
              error={errors.description}
            />
          </div>
          <div>
            <label
              htmlFor="category"
              className="mb-2 block text-sm font-medium"
            >
              Category
            </label>
            <select
              id="category"
              name="category"
              defaultValue={initial?.category ?? ""}
              className="h-11 w-full rounded-md border bg-white px-3"
              aria-describedby="category-error"
            >
              <option value="">Choose a category</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <p id="category-error" className="text-sm text-destructive">
              {errors.category?.[0]}
            </p>
          </div>
          <Field
            name="venue_name"
            label="Venue name"
            defaultValue={initial?.venue_name ?? ""}
            maxLength={160}
            error={errors.venue_name}
          />
          <Field
            name="address"
            label="Venue address"
            defaultValue={initial?.address ?? ""}
            maxLength={500}
            error={errors.address}
          />
          <Field
            name="city"
            label="City"
            defaultValue={initial?.city ?? ""}
            maxLength={100}
            error={errors.city}
          />
          <Field
            name="starts_at"
            label="Starts at (Asia/Dhaka)"
            type="datetime-local"
            defaultValue={initial?.starts_at ?? ""}
            error={errors.starts_at}
          />
          <Field
            name="ends_at"
            label="Ends at (Asia/Dhaka)"
            type="datetime-local"
            defaultValue={initial?.ends_at ?? ""}
            error={errors.ends_at}
          />
          <Field
            name="ticket_name"
            label="Ticket category"
            defaultValue={initial?.ticket_name ?? ""}
            maxLength={100}
            error={errors.ticket_name}
          />
          <Field
            name="price"
            label="Ticket price (BDT)"
            type="number"
            step="0.01"
            min="0"
            max="10000000"
            defaultValue={initial?.price ?? ""}
            error={errors.price}
          />
          <Field
            name="capacity"
            label="Capacity"
            type="number"
            step="1"
            min="1"
            max="10000000"
            defaultValue={initial?.capacity ?? ""}
            error={errors.capacity}
          />
          <div className="sm:col-span-2">
            <Button type="submit">{busy ? "Working…" : "Save draft"}</Button>
          </div>
        </fieldset>
      </form>
      <div className="mt-6 border-t pt-6">
        <label htmlFor="poster" className="block font-medium">
          Poster image
        </label>
        <p className="subtle">
          JPEG, PNG or WebP, up to 5 MB. Save your first draft before uploading.
          After uploading, save the draft to apply the poster.
        </p>
        <input
          id="poster"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy || locked || !record}
          className="my-3 block max-w-full"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !record) return;
            setBusy(true);
            setMessage("");
            try {
              const form = new FormData();
              form.set("poster", file);
              const response = await fetch(
                `/api/host/events/${record.id}/poster`,
                { method: "POST", body: form },
              );
              const result: Result = await response.json();
              if (!response.ok) throw new Error(result.error);
              setPoster(result.path!);
              setDirty(true);
              setMessage("Poster uploaded. Save the draft to apply it.");
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Upload failed.");
            } finally {
              setBusy(false);
            }
          }}
        />
        {poster && (
          <p className="text-sm">
            Poster selected.{" "}
            <button
              type="button"
              className="text-link"
              disabled={busy || locked}
              onClick={() => {
                setPoster(null);
                setDirty(true);
              }}
            >
              Remove on next save
            </button>
          </p>
        )}
      </div>
      <div className="mt-6 border-t pt-6">
        <p className="mb-3 text-sm">
          Save your latest changes first. Submission sends the saved draft for
          review.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={
            busy ||
            dirty ||
            !record ||
            !["draft", "changes_requested"].includes(record.status)
          }
          onClick={submit}
        >
          Submit for review
        </Button>
      </div>
      <p role="status" aria-live="polite" className="mt-4">
        {message}
      </p>
    </div>
  );
}
