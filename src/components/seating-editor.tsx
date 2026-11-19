"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EventDetail } from "@/lib/events";
import { Button } from "@/components/ui/button";
export function SeatingEditor({ event }: { event: EventDetail }) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <section className="panel mt-6">
      <h2 className="text-xl font-bold">Demo concert hall seating</h2>
      <p className="my-3">
        Assign numbered seats to one ticket category. Other categories remain
        general admission. Saving a published layout returns the event to draft
        for review. Layouts with reservation history cannot be replaced.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setBusy(true);
          try {
            const response = await fetch(
              `/api/host/events/${event.id}/seating`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  version: event.version,
                  category_id: data.get("category"),
                  rows: Number(data.get("rows")),
                  columns: Number(data.get("columns")),
                }),
              },
            );
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            setMessage(result.message);
            router.refresh();
          } catch (e) {
            setMessage(
              e instanceof Error ? e.message : "Could not save seating.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset
          disabled={busy || event.status === "pending_review"}
          className="flex flex-wrap items-end gap-4"
        >
          <label>
            Ticket category
            <select name="category" className="block rounded border p-2">
              {event.tickets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (capacity {t.capacity})
                </option>
              ))}
            </select>
          </label>
          <label>
            Rows
            <input
              className="block w-20 rounded border p-2"
              name="rows"
              type="number"
              min={1}
              max={8}
              defaultValue={4}
              required
            />
          </label>
          <label>
            Seats per row
            <input
              className="block w-20 rounded border p-2"
              name="columns"
              type="number"
              min={1}
              max={12}
              defaultValue={6}
              required
            />
          </label>
          <Button type="submit">Assign seating</Button>
        </fieldset>
      </form>
      <p role="status" className="mt-4">
        {message}
      </p>
    </section>
  );
}
