# Sprint 1 Division 2 progress

Implementation and verification: 12–13 November 2026, Asia/Dhaka. This extends the [Division 1 handoff](sprint-1-division-1.md). Existing Division 1 records and migration were preserved; no database reset was performed.

## Scope

| SRS area                                   | Division 2 delivery                                                                                                                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1 event creation and publishing           | Verified web editor and JSON APIs with incomplete drafts, explicit submission, private posters, transactional publication and withdrawal                                                        |
| F17 host verification and event moderation | Verified host approval and event moderation through the real backend, including the administrator queue, mandatory feedback, resubmission, publication, history and competing-review protection |
| F5 event discovery — **partial**           | Public persisted catalogue, title/category/city/Dhaka-date filters, stable pagination, details and starting prices. Price and availability filters and full sorting requirements remain.        |
| F2–F4 — **foundations only**               | Separate venue, session and ticket-category records. One session/category in the first editor; no seating, inventory reservation or booking workflows.                                          |

The application follows views → controllers → services → repositories → PostgreSQL. See the [Division 2 JSON API contract](division-2-api.md). Host approval requires both the protected `host` role and the existing approved `host_profiles` row. Administrator authority comes only from protected `user_roles` rows.

## Database and security

Confirmed the connected project reference `euuastddghdsyodcnfhp`, inspected its live Division 1 tables, role records and migration history, then applied the tested incremental migrations:

- `20261112174847_division2.sql`
- `20261112175534_event_conflict_responses.sql`
- `20261112180128_event_view_grants.sql`

Local filenames match the hosted migration history. The second migration fixes a problem exposed by real integration testing: business conflicts must return PostgREST HTTP 409 (`PT409`), not a serialization error treated as a retryable HTTP 500. It also rejects whitespace-only required fields during direct database submission. The third explicitly revokes inherited view DML grants from Supabase's defaults; event detail access is read-only at the view and underlying table layers.

Event children, status and history share one transaction and parent-row lock. Optimistic versions reject stale writes and competing decisions. Pending events are read-only. Published edits withdraw immediately. Public server pages are dynamic and APIs/poster responses are uncached. Unpublished public URLs show **Event unavailable**, even for signed-in reviewers; event JSON and poster endpoints return HTTP 404. Next.js can stream the HTML unavailable screen with HTTP 200 after the parent loading boundary has sent headers; no event details are rendered. The private Storage bucket has MIME/size limits; immutable paths prevent changes to an already published poster. Public visibility follows the current referenced event status. No privileged key is required by the app.

Supabase's security advisor found no new Division 2 issues. Existing Division 1 callable definer functions and disabled leaked-password protection remain advisor warnings. Email delivery/confirmation-enabled signup was not reverified.

## Verification

The final verification completed on 13 November 2026 using Node 24.11.0. All listed commands passed.

| Command                                                        | Actual result                | Verification boundary                                                                                                                                                             |
| -------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                                 | Passed                       | ESLint source checks                                                                                                                                                              |
| `npm run typecheck`                                            | Passed                       | TypeScript checks                                                                                                                                                                 |
| `npm test`                                                     | **38 passed** across 8 files | Unit/controller tests use mocked identity. Database suites execute the migrations, grants, RLS and transactions in embedded PostgreSQL with scaffolded Auth and Storage metadata. |
| `npm run build`                                                | Passed                       | Next.js production compilation and route generation                                                                                                                               |
| `npm run test:e2e -- --workers=2`                              | **12 passed**                | Desktop/mobile public pages, filters, navigation, denied access and responsive layout against the production build                                                                |
| `npm run test:integration -- --maxWorkers=1` with event opt-in | **1 passed, 3 skipped**      | New event suite uses actual hosted Supabase Auth, PostgREST, PostgreSQL and Storage. The 3 skipped Division 1 tests require their separate service-key opt-in.                    |
| `npm run test:e2e:live -- events.spec.ts` with event opt-in    | **1 passed**                 | Full real-browser correction, publication, discovery, refresh and withdrawal flow with separate host, admin and signed-out contexts                                               |
| Hosted schema/grant audit                                      | Passed                       | All six event tables have RLS. Both `anon` and `authenticated` have only SELECT on the event detail view.                                                                         |

The live browser demo used **Dhaka Unplugged**, a future **20 December 2099** session entered in Dhaka time, a persisted poster, and **BDT 500 General Admission**. It verified incomplete-draft persistence, field errors, pending edit locks, review feedback, correction and resubmission, public combined filters, detail refresh, and withdrawal from search, public detail content, JSON and poster endpoints. The hosted database suite additionally verified competing decisions, customer denial, second-host denial, invalid submission rollback, direct-write denial and private/public Storage visibility.

Desktop and mobile screenshots were visually checked and copied to the ignored local files `.qa/division2-detail-desktop.png` and `.qa/division2-detail-mobile.png`. The completed sample remains withdrawn as a draft. Dedicated test accounts and fixture records remain in the development project for repeatable demonstrations. Their generated logins are in the ignored `.qa/event-test-users.json` on this workspace. The prior Division 1 live registration suite and email delivery were outside this final run.

The default Vitest worker count is bounded to one because parallel PostgreSQL WASM workers exceeded this machine's memory limit. The final default `npm test` run passed. Browser upload assertions allow up to 30 seconds for the real 2 MB poster transfer. The complete live demo passed in approximately 2.7 minutes.

The new hosted suite is opt-in:

```powershell
$env:SUPABASE_TEST_EVENTS = 'true'
$env:SUPABASE_TEST_URL = 'https://YOUR_DEVELOPMENT_PROJECT.supabase.co'
$env:SUPABASE_TEST_PUBLISHABLE_KEY = 'YOUR_PUBLISHABLE_KEY'
$env:SUPABASE_TEST_EVENT_USERS_FILE = '.qa/event-test-users.json'
npm run test:integration -- --maxWorkers=1
npm run test:e2e:live -- events.spec.ts
```

The ignored fixture file is an array of `{ role, id, email, password }` for `admin`, `host`, `other`, and `customer`. Supply dedicated existing test users; only the administrator must be bootstrapped beforehand. Tests approve the two test hosts through the real Division 1 workflow. They create event records and poster objects in that development project and deliberately leave the completed sample withdrawn as a draft. Do not run against production. No credentials, `.env.local`, browser reports, or test-user fixtures are tracked. The older Division 1 hosted suites retain their separate opt-in and are not counted as passes when skipped.

## Faculty demonstration

Use separate browser profiles for an approved host and an administrator, plus an incognito visitor. Use existing accounts or follow the [Division 1 setup](setup.md) to bootstrap an administrator and approve a host.

1. At `/host`, choose **Create event**. Save only the title **Dhaka Unplugged**, leave, and reopen to show draft persistence.
2. Complete the description, Concert category, a Dhaka venue/address, a future start/end in Asia/Dhaka, **General Admission**, **BDT 500**, and positive capacity. Upload a poster, then **Save draft**. **Submit for review** separately.
3. At `/admin/events`, open the pending event and **Request changes** with “Please specify the north entrance.”
4. On the host dashboard, show that feedback. Open the event, correct the address, save, and resubmit.
5. As administrator, **Approve and publish**. As the signed-out visitor, combine title, Concert, Dhaka and the session date at `/events`. Open the result, show **BDT 500**, and refresh the detail URL.
6. Open the published host editor: it remains public. Explain the withdrawal warning, save an edit, then show that search no longer finds it and the old detail URL shows **Event unavailable**. Its public JSON and poster endpoints return 404.

Vercel: this checkout has no existing linked/authorized preview workflow (`.vercel` is absent; the Division 1 handoff records Vercel as unconnected). No deployment or preview URL is claimed. A Vercel account/project connection is still needed for a hosted web preview; local web execution uses the hosted development Supabase backend.


## Sprint 2 continuation

The local Sprint 2 Division 1 implementation and its own verification record are documented in [the reservation handoff](sprint-2-division-1.md). The historical Sprint 1 results above do not establish Sprint 2 acceptance.
