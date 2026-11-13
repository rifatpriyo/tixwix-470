import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database, Viewer } from "@/lib/domain";
import { EventRepository } from "@/repositories/events";
import { requireRole } from "@/services/authorization";
import { AppError } from "@/lib/errors";
import {
  draftSchema,
  eventInput,
  submissionSchema,
  type EventInput,
  type EventStatus,
} from "@/lib/events";
import { supabaseConfig } from "@/lib/config";

export function publicEvents() {
  const { url, key } = supabaseConfig();
  return new EventRepository(
    createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  );
}
export class EventService {
  constructor(
    public repository: EventRepository,
    private viewer: Viewer,
  ) {}
  async detail(id: string, admin = false) {
    requireRole(this.viewer, admin ? "admin" : "host");
    const event = await this.repository.find(id);
    if (!event || (!admin && event.host_id !== this.viewer.id))
      throw new AppError(404, "Event not found.");
    return { event, reviews: await this.repository.history(id) };
  }
  list(status: EventStatus | "all", page: number, admin = false) {
    requireRole(this.viewer, admin ? "admin" : "host");
    return this.repository.list(admin ? null : this.viewer.id, status, page);
  }
  async save(
    id: string | null,
    version: number | null,
    input: EventInput,
    poster: string | null,
  ) {
    requireRole(this.viewer, "host");
    if (id) await this.detail(id);
    return this.repository.save(id, version, draftSchema.parse(input), poster);
  }
  async transition(
    id: string,
    version: number,
    action: string,
    feedback: string | null,
  ) {
    const { event } = await this.detail(id, action !== "submit");
    if (action === "submit") submissionSchema.parse(eventInput(event));
    return this.repository.transition(id, version, action, feedback);
  }
}
