# Sprint 2, Division 1 — reservations

Implementation reviewed and verification performed on 19 November 2026 (Asia/Dhaka). See the results below; live Supabase acceptance remains separate.

## Scope

Session-specific numbered seating and general admission; keyboard-accessible seat selection; on-demand Three.js approximate audience preview for the demo concert hall; pending booking/hold creation; server-calculated BDT price snapshots; cancellation and database-clock expiry; idempotent checkout; private ownership checks; availability polling every three seconds and on reconnect/focus.

F6 is implemented with an independently verified 3D preview and fallback. F7 is implemented with PostgreSQL concurrency and ownership verification. The integrated authenticated browser flow still requires the local Supabase acceptance run described below. F8 is partial: this division ends at pending/canceled/expired. Payment, paid confirmation, discounts, tickets, QR and check-in remain Sprint 2 Division 2. Sprint 1 F5 remains partial and F2–F4 remain foundations.

## Architecture and inventory rules

Views are in `src/components` and `src/app`; route controllers delegate through `ReservationService` and `ReservationRepository`. The existing verified caller context supports cookies and bearer tokens. Database roles, not editable user metadata, determine permissions.

The additive migration `20261117164313_session_reservations.sql` introduces `event_seats`, `bookings`, `booking_items`, `booking_history`, and category `inventory_kind`. Existing categories default to general admission. Capacity is per category per session; each showtime gets independent inventory. The demo hall maps one category to at most 8 rows × 12 seats. Other categories remain general admission.

Every reservation mutation takes the parent event row lock, sharing the lock with Sprint 1 edits and publication transitions. This deliberately serializes all sessions of a small event for correctness. A future scale-up may introduce finer locks after preserving the host-edit ordering. A per-customer/request advisory lock serializes idempotent retries. Database transactions commit immediately; no lock is held for the reservation duration.

`private.hold_duration()` is the single 10-minute duration definition. Availability, checkout and reservation reads/releases expire overdue bookings under the event lock, recording history. Allocation queries also exclude past expiry timestamps, so delayed cleanup cannot block reclamation. No scheduler is required for correctness; untouched expired rows are materialized as expired on the next relevant request.

Session/category IDs remain stable. Foreign keys protect reservation history from deletion. Capacity reductions below current allocations or mapped seat count fail. Active sessions cannot be rescheduled. Layout replacement is disallowed after any booking history. Published host layout edits withdraw the event for review. The existing Sprint 1 editor still edits its first session/category; additional demo sessions/categories come from the seed script.

Public availability contains seat status and remaining counts only. Booking tables use ownership RLS, grant no direct writes, and are not subscribed to Realtime. Private security-definer workflows have fixed empty search paths and explicit authorization; exposed wrappers use security invoker with explicit execute grants. Prices come only from stored category values and are copied into immutable booking items.

## Local setup and demonstration

Use Node from `.nvmrc` or Node 24. Install the lockfile with `npm ci`. Docker is needed for a complete local Supabase stack. Inspect CLI `--help` before using installed-version-specific commands. Start local Supabase and apply pending migrations using `supabase migration up --local`; never reset or apply these fixtures to the shared project.

Configure `.env.local` with the local API URL and publishable key from `supabase status`. Keep `APP_URL=http://127.0.0.1:3000`. Provide these variables only in the seed/test process:

```text
SUPABASE_TEST_URL=http://127.0.0.1:54321
SUPABASE_TEST_PUBLISHABLE_KEY=<local publishable key>
SUPABASE_TEST_SERVICE_ROLE_KEY=<local service-role key>
SUPABASE_TEST_DB_URL=postgresql://postgres:<local password>@127.0.0.1:54322/postgres
```

Run `node scripts/seed-reservation-demo.mjs`. It creates four dedicated accounts (admin, approved host, two customers), a published demo event with 24 numbered seats, a general-admission category of capacity five, and two future sessions. It refuses non-loopback URLs, checks that the migration exists, and never resets data. Each run adds a distinct fixture. Credentials are written only to ignored `.qa/reservation-demo-users.json`; the event slug is in `.qa/reservation-demo.json`.

Build and start the app. In separate browser profiles, sign in with the two customer accounts and open the seeded `/events/[slug]`:

1. Select the same showtime in both profiles. Customer A selects A1 and explores its 3D audience view. Focus D1 to compare the rear viewpoint without changing selection.
2. A continues to checkout. B sees A1 become unavailable within about three seconds. Refresh A's checkout: booking, price and expiry persist.
3. A releases the reservation. B can select A1 and continue to checkout. Release B's hold before repeating.
4. For natural expiry, wait ten minutes. Availability becomes reclaimable from the database clock. Switching showtimes leaves the other show's A1 independent.
5. Sign in as the host and open `/host/events/[id]` to inspect the layout controls. Existing reservations prevent replacing the layout. A newly created unbooked draft can receive a new layout before submission.

The preview is a simplified demo hall, not a measured venue sightline. Its camera position varies with row and seat. General admission has no mapped preview. Unsupported WebGL/context loss or a failed viewer load leaves the 2D map usable.

## JSON API for Flutter and the payment teammate

All paths return private/no-store responses. Cookie mutations require the application Origin and JSON content type. Native clients send `Authorization: Bearer <Supabase access token>` and JSON. Never submit user IDs, roles, prices or expiry timestamps.

| Method and path | Payload / result |
| --- | --- |
| GET `/api/sessions/:id/availability` | Public `session_id`, `server_now`, `eligible`, `preview`, `seats`, `categories`. Seat includes section/row/label/category and boolean availability. GA category includes remaining quantity. |
| POST `/api/reservations` | `{session_id,idempotency_key,seat_ids:[],general_admission:[{category_id,quantity}]}` → `{reservation}`. Choose 1–20 tickets total. UUID retry key required. |
| GET `/api/reservations/:id` | Owner-only `{reservation}`; expires overdue state before returning. |
| POST `/api/reservations/:id/release` | JSON `{}`; owner-only, idempotent release. An already expired booking stays expired. |
| PUT `/api/host/events/:id/seating` | `{version,category_id,rows,columns}`; approved owner only, optimistic version and review lock enforced. |

A reservation includes ID, event/session, state, original expiry, database `server_now`, currency `BDT`, total minor units and line items (category/seat label, quantity, unit price minor units). A repeated identical request returns the same ID, total, expiry and current state, including canceled/expired reservations; a different request under the same key returns 409. Use a new key for an intentional new reservation. A multi-seat or mixed-inventory conflict is atomic. Relevant HTTP codes: 401 sign-in required, 403 forbidden, 404 unavailable/non-owned, 409 conflict, 422 invalid selection, 503 database unavailable.

For payment integration, extend the database state machine and allocation rules transactionally; never trust the browser's countdown or total. Existing line-item snapshots are the price source. Payment confirmation and callbacks are intentionally absent.

## Verification

| Check actually run | Result | What it establishes |
| --- | --- | --- |
| `npm run lint` | Passed | Repository lint checks |
| `npm run typecheck` | Passed | TypeScript checks |
| `npm test` | **42 passed, 10 files** | Sprint 1 regressions, reservation validation, and embedded PGlite workflows; Auth/Storage scaffolded |
| `npm run test:postgres` | **13 checks passed; exit 0** | Fresh native PostgreSQL 18.6, separate connections, competing holds and GA claims, atomicity, retries, ownership, expiry, host edit guards |
| `npm run test:preview` | **2 checks passed** | Real Chromium WebGL front/rear rendering and deliberate no-WebGL fallback; screenshots inspected |
| `npm run build` | Passed | Production webpack build, TypeScript, page generation and route registration |
| `npm run test:e2e -- --workers=1 --timeout=90000` | **12 passed** | Desktop/mobile public pages, navigation, protected checkout redirect/API denial, filters, callback and input protections |
| `npm run test:integration` | **4 skipped** | No Supabase test credentials; not counted as passing |
| `npm run test:e2e:live -- reservations.spec.ts` | **1 skipped** | Full authenticated two-customer Supabase browser acceptance remains unverified |

The first browser run with two workers hit two 30-second desktop navigation timeouts; all checks passed with one worker and a 90-second limit. No application assertions were weakened. The native runner now uses graceful `pg_ctl` shutdown on Windows because the package's force-stop left a PostgreSQL 18 I/O worker behind; the final run stopped cleanly. No shared database was reset, seeded, or migrated.

Required commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:postgres`, `npm run build`, then `npm run test:e2e`.

`npm test` includes existing Sprint 1 mocked/controller tests and embedded PostgreSQL (PGlite) regressions. PGlite has scaffolded Auth/Storage and does not prove simultaneous connections.

`npm run test:postgres` launches a fresh native PostgreSQL server on loopback port 55439 in a unique ignored `.qa` directory. It applies every migration, scaffolds Auth/Storage only, and uses separate real database connections for concurrency. It tests same-seat competition, all-or-nothing selection, last GA ticket, session independence, retry identity/expiry, ownership, release, expiry reclamation, host guards and publication/session eligibility. It does not exercise Supabase Auth or PostgREST. Override the port with `TIXWIX_TEST_PG_PORT` if occupied. The server is stopped after the run; its isolated files remain for inspection.

Actual two-customer browser acceptance is opt-in after seeding local Supabase and building against it:

```powershell
$env:SUPABASE_TEST_RESERVATIONS = 'true'
$env:SUPABASE_TEST_EVENT_USERS_FILE = '.qa/reservation-demo-users.json'
npm run test:e2e:live -- reservations.spec.ts
```

This checks real login, the normal public detail entry point, distinct front/rear rendered views, live availability, checkout refresh, ownership denial, release and reclamation. Skipped suites are not passes.
### Windows path workaround

Vite treats the `#` in this checkout's physical path as a URL fragment. Tests first failed before execution with `EISDIR: read E:/`. A temporary drive alias plus preserved module paths allows the same working tree to run without moving it:

```powershell
# Choose an unused drive letter. This example maps the parent folder.
subst T: 'E:\#BRACU\470 proj'
Set-Location 'T:\tixwix-470'
$env:PATH = (Resolve-Path '.qa/node-v24.11.0-win-x64').Path + ';' + $env:PATH
$env:NODE_OPTIONS = '--preserve-symlinks --preserve-symlinks-main'
npm test
npm run test:integration
```

The `.qa` runtime path is this workstation's ignored Node installation; a normal Node 24 installation on PATH also works. `vitest.config.ts` preserves aliases. Return to the original path and run `subst T: /D` after all processes using the alias have stopped.

`npm run test:preview` bundles the production preview component into an isolated browser harness. Chromium verifies actual WebGL rendering, different front/rear viewpoints, and a deliberate no-WebGL fallback with usable selection controls. Screenshots are ignored under `.qa/preview-front.png` and `.qa/preview-rear.png`; both were visually inspected. This is component verification, not a Supabase login/checkout integration test.

### Remaining acceptance environment

This checkout has no `.env.local`, local Supabase service credentials, or Docker installation on PATH. The shared development database was not modified. The migration was applied only to fresh isolated native PostgreSQL/PGlite test databases. The local Supabase seed script and `tests/e2e-live/reservations.spec.ts` are supplied but require the documented local stack before their full authenticated flow can be verified. Four existing real-Supabase integration tests were skipped, not passed. No payment, ticket issuance, or QR workflow is included.

## Changed-file guide

- `supabase/migrations/20261117164313_session_reservations.sql`: inventory, bookings/history, transactional RPCs, grants/RLS and host-edit guards.
- `src/lib/reservations.ts`, `src/lib/domain.ts`, `src/repositories/reservations.ts`, `src/services/reservations.ts`, `src/controllers/reservations.ts`: typed contract, validation, persistence, authorization and HTTP handling.
- `src/app/api/sessions/[id]/availability`, `src/app/api/reservations`, `src/app/api/host/events/[id]/seating`: public availability, private checkout/release and owned layout APIs.
- `src/components/seat-booking.tsx`, `seat-preview.tsx`, `preview-boundary.tsx`, `pending-checkout.tsx`, `seating-editor.tsx`: public selection/preview, fallback, pending checkout and host setup.
- `src/app/events/[slug]/page.tsx`, `src/app/host/events/[id]/page.tsx`, `src/app/checkout/[id]/page.tsx`: normal application entry points.
- `scripts/seed-reservation-demo.mjs`, `scripts/verify-preview.mjs`, new reservation tests under `tests/unit`, `tests/database`, `tests/native`, `tests/e2e-live`, and `tests/support/reservation-fixture.sql`: reproducible fixtures and layered verification. `tests/e2e/public.spec.ts` also covers the new protected route.
- `package.json` / lockfile: pinned Three.js and test dependencies, native PostgreSQL and preview commands. `tsconfig.json` / `eslint.config.mjs` exclude ignored local tooling; `vitest.config.ts` preserves the Windows test alias.
- `.env.example`, README and the existing Sprint 1 Division 2 handoff link to this division and its setup/verification limits.

Changes are left uncommitted in the local working tree for review. F8 remains partial; F6/F7's full Supabase browser acceptance is explicitly outstanding above.
