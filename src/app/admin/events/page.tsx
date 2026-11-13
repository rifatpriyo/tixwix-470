import { protectedPage } from "@/services/context";
import { EventRepository } from "@/repositories/events";
import { ManagedEvents } from "@/components/managed-events";
import { eventStatuses } from "@/lib/events";
import { z } from "zod";
export default async function EventQueue({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { db } = await protectedPage("admin");
  const params = await searchParams;
  const status = z
    .enum([...eventStatuses, "all"])
    .catch("pending_review")
    .parse(params.status ?? "pending_review");
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .catch(1)
    .parse(params.page ?? 1);
  return (
    <div className="page">
      <h1 className="page-title">Event review queue</h1>
      <form className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="status" className="block text-sm">
            Status
          </label>
          <select
            name="status"
            id="status"
            defaultValue={status}
            className="mt-2 rounded-md border bg-white p-3"
          >
            {[...eventStatuses, "all"].map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <button className="rounded-md bg-primary px-5 py-3 text-white">
          Filter
        </button>
      </form>
      <ManagedEvents
        repository={new EventRepository(db)}
        hostId={null}
        status={status}
        page={page}
      />
    </div>
  );
}
