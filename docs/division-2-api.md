# Division 2 JSON API

All endpoints use Node.js Route Handlers. Responses are `private, no-store`. Public routes always query as an anonymous visitor, including when the caller has an administrator session. Protected routes validate the Supabase identity and read database roles. Cookie mutations require the application Origin; native clients can send a Supabase `Authorization: Bearer <access_token>` header. No client role or owner ID authorizes an operation.

| Method and route                                      | Access / response                                                                                                            |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/events?q=&category=&location=&date=&page=1` | Public catalogue, published events with an upcoming or ongoing session; `{ events, total, page, pageSize: 12 }`              |
| `GET /api/events/[slug]`                              | Published event details, otherwise 404; `{ event }`                                                                          |
| `GET /api/event-posters/[id]`                         | Current poster bytes; public only while the event is published, otherwise owner/reviewer only                                |
| `GET /api/host/events?page=1&status=all`              | Owning host's records with private review history; 20 per page                                                               |
| `POST /api/host/events`                               | Approved host creates an incomplete or complete draft; 201 `{ event }`                                                       |
| `GET /api/host/events/[id]`                           | Owner only; `{ event, reviews }`                                                                                             |
| `PUT /api/host/events/[id]`                           | Owner saves a draft; a published event becomes draft atomically                                                              |
| `POST /api/host/events/[id]/poster`                   | Owner uploads multipart `poster`; 201 `{ path }`. Apply the returned path in a separate save. Pending events reject uploads. |
| `POST /api/host/events/[id]/submit`                   | Owner submits the saved draft or correction; `{ event }`                                                                     |
| `GET /api/admin/events?status=pending_review&page=1`  | Administrator queue; 20 per page                                                                                             |
| `GET /api/admin/events/[id]`                          | Administrator detail and history                                                                                             |
| `POST /api/admin/events/[id]/review`                  | Administrator requests changes or publishes a pending event                                                                  |

Create/save example (use `version: null` for creation; current integer version for edits):

```json
{
  "version": null,
  "poster": null,
  "data": {
    "title": "Dhaka Unplugged",
    "description": "An evening of acoustic music with local artists.",
    "category": "concert",
    "venue_name": "Acoustic Hall",
    "address": "12 Dhanmondi Road",
    "city": "Dhaka",
    "starts_at": "2027-12-20T18:00",
    "ends_at": "2027-12-20T21:00",
    "ticket_name": "General Admission",
    "price": "500.00",
    "capacity": "100"
  }
}
```

Times in this JSON contract are Dhaka local `YYYY-MM-DDTHH:mm`; persisted timestamps are `timestamptz`. Empty strings and null ticket values permit incomplete drafts. Provided prices must be nonnegative with at most two decimal places; capacity must be a positive integer. Prices are stored in integer paisa (`500 BDT = 50000`). End time must follow start time. The editor handles one session and one ticket category; separate tables and public output support multiple records as a foundation for later divisions.

Submit: `{ "version": 2, "action": "submit" }`. Review: `{ "version": 3, "action": "request_changes", "feedback": "Specify the entrance." }` or `{ "version": 6, "action": "publish" }`. A correction reason is mandatory. Concurrent/repeated decisions return HTTP 409 once the version changes; they never append duplicate history or overwrite the winning review. Refresh before retrying. Opening the editor is read-only.

Validation errors return HTTP 422 with `{ error, code, fields }`; `fields` uses editor keys such as `ends_at`, `price`, and `capacity`. An incomplete submission leaves the stored draft unchanged. Other common responses are 401, 403, 404, 409 and 503. Poster uploads validate JPEG/PNG/WebP MIME type, signature and a maximum 5 MiB size; object names are immutable and ownership is checked again in Storage and the save transaction. Uploaded but unsaved objects remain private. Published posters cannot be overwritten or deleted through direct Storage APIs. No signed public URL is handed out.

Public filtering is performed in PostgreSQL: case-insensitive literal title substring, exact category, case-insensitive city substring, and a Dhaka calendar-day session-start range combine with AND. Allowed categories: `sports`, `concert`, `movie`, `comedy`, `other`. Pagination is bounded to pages 1–1000 with 12 results per page, ordered by upcoming session then event ID. No price/availability filters or selectable sort are implemented in this division. Public output has the organizer display name, but no organizer contacts or moderation history.

Database writes go through invoker RPC wrappers calling guarded functions in the non-exposed `private` schema. Those functions lock the parent row, validate identity/ownership/version, change children/status, and append transition history in one transaction. Application roles have no direct DML grants on event tables. All event tables have RLS; the detail view uses `security_invoker=true`. Public queries, including child table access, enforce publication independently of the website.

References checked during implementation: [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [PostgREST custom HTTP errors](https://docs.postgrest.org/en/stable/references/errors.html#raise-errors-with-http-status-codes), [Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route).
