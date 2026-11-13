import { describe, it, expect, beforeAll } from "vitest";
import {
  approveTestHosts,
  eventClient,
  loginEventUser,
} from "../support/event-users";
const enabled =
  process.env.SUPABASE_TEST_EVENTS === "true" &&
  !!process.env.SUPABASE_TEST_EVENT_USERS_FILE;
describe.skipIf(!enabled)(
  "Division 2 real Supabase Auth, PostgREST and Storage",
  () => {
    beforeAll(approveTestHosts);
    it("enforces the complete workflow, competing reviews, child RLS, and immutable private Storage", async () => {
      const { db: host, user } = await loginEventUser("host"),
        { db: other } = await loginEventUser("other"),
        { db: customer } = await loginEventUser("customer"),
        { db: admin } = await loginEventUser("admin"),
        anon = eventClient();
      const payload = {
        title: "Dhaka Unplugged integration",
        description: "An evening of acoustic music in Dhaka.",
        category: "concert",
        venue_name: "Acoustic Hall",
        address: "12 Dhanmondi",
        city: "Dhaka",
        starts_at: "2099-12-20T00:30:00+06:00",
        ends_at: "2099-12-20T02:30:00+06:00",
        ticket_name: "General Admission",
        price_minor: 50000,
        capacity: 100,
        poster: null as string | null,
      };
      expect(
        (
          await customer.rpc("save_event", {
            p_id: null,
            p_version: null,
            p_data: payload,
          })
        ).error?.code,
      ).toBe("42501");
      let saved = await host.rpc("save_event", {
        p_id: null,
        p_version: null,
        p_data: { title: payload.title },
      });
      expect(saved.error).toBeNull();
      let e = saved.data!;
      expect(
        (
          await host.rpc("transition_event", {
            p_id: e.id,
            p_version: e.version,
            p_action: "submit",
            p_feedback: null,
          })
        ).error?.code,
      ).toBe("22023");
      expect(
        (
          await other.rpc("save_event", {
            p_id: e.id,
            p_version: e.version,
            p_data: payload,
          })
        ).error?.code,
      ).toBe("42501");
      const path = `${user.id}/${e.id}/test.png`;
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=",
        "base64",
      );
      expect(
        (
          await host.storage
            .from("event-posters")
            .upload(path, png, { contentType: "image/png", cacheControl: "0" })
        ).error,
      ).toBeNull();
      payload.poster = path;
      expect(
        (await anon.storage.from("event-posters").download(path)).error,
      ).not.toBeNull();
      expect(
        (await other.storage.from("event-posters").download(path)).error,
      ).not.toBeNull();
      saved = await host.rpc("save_event", {
        p_id: e.id,
        p_version: e.version,
        p_data: payload,
      });
      expect(saved.error).toBeNull();
      e = saved.data!;
      async function move(action: string, feedback: string | null = null) {
        const result = await (action === "submit" ? host : admin).rpc(
          "transition_event",
          {
            p_id: e.id,
            p_version: e.version,
            p_action: action,
            p_feedback: feedback,
          },
        );
        expect(result.error).toBeNull();
        e = result.data!;
      }
      await move("submit");
      expect(
        (
          await host.rpc("save_event", {
            p_id: e.id,
            p_version: e.version,
            p_data: payload,
          })
        ).error?.code,
      ).toBe("PT409");
      expect(
        (await admin.storage.from("event-posters").download(path)).error,
      ).toBeNull();
      await move("request_changes", "Clarify entrance.");
      saved = await host.rpc("save_event", {
        p_id: e.id,
        p_version: e.version,
        p_data: { ...payload, address: "North entrance, 12 Dhanmondi" },
      });
      expect(saved.error).toBeNull();
      e = saved.data!;
      await move("submit");
      const concurrent = await Promise.all(
        ["publish", "request_changes"].map((action) =>
          admin.rpc("transition_event", {
            p_id: e.id,
            p_version: e.version,
            p_action: action,
            p_feedback: "Concurrent review",
          }),
        ),
      );
      expect(concurrent.filter((r) => !r.error)).toHaveLength(1);
      expect(concurrent.find((r) => r.error)?.error?.code).toBe("PT409");
      e = concurrent.find((r) => !r.error)!.data!;
      if (e.status === "changes_requested") {
        await move("submit");
        await move("publish");
      }
      const results = await anon.rpc("search_events", {
        p_query: payload.title,
        p_category: "concert",
        p_location: "Dhaka",
        p_date: "2099-12-20",
        p_page: 1,
      });
      expect(results.error).toBeNull();
      expect(
        results.data!.events.some(
          (x) => x.id === e.id && x.starting_price === 50000,
        ),
      ).toBe(true);
      expect(JSON.stringify(results.data)).not.toContain("private-contact");
      expect(JSON.stringify(results.data)).not.toContain("Clarify entrance");
      expect(
        (await anon.from("event_details").select("*").eq("slug", e.slug)).data,
      ).toHaveLength(1);
      expect(
        (await anon.storage.from("event-posters").download(path)).error,
      ).toBeNull();
      expect(
        (
          await host.storage
            .from("event-posters")
            .update(path, png, { contentType: "image/png" })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await host
            .from("events")
            .update({ status: "published" })
            .eq("id", e.id)
        ).error,
      ).not.toBeNull();
      expect(
        (await anon.from("event_reviews").select("*")).error,
      ).not.toBeNull();
      saved = await host.rpc("save_event", {
        p_id: e.id,
        p_version: e.version,
        p_data: payload,
      });
      expect(saved.error).toBeNull();
      e = saved.data!;
      expect(e.status).toBe("draft");
      expect(
        (await anon.from("event_details").select("*").eq("slug", e.slug)).data,
      ).toHaveLength(0);
      expect(
        (
          await anon.rpc("search_events", {
            p_query: payload.title,
            p_category: "concert",
            p_location: "Dhaka",
            p_date: "2099-12-20",
            p_page: 1,
          })
        ).data?.events,
      ).toHaveLength(0);
      expect(
        (await anon.storage.from("event-posters").download(path)).error,
      ).not.toBeNull();
    }, 180000);
  },
);
