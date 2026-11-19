# TixWix

**CSE470 · Sprint 1 Divisions 1–2 and Sprint 2 Division 1**

TixWix supports **approved host → event draft → correction → resubmission → administrator publication → public discovery**, building on Division 1 registration, roles, host verification and dashboards.

Division 2 is implemented and its incremental migrations are applied to the confirmed development Supabase project `euuastddghdsyodcnfhp`. The application runs locally against that backend. Vercel preview deployment remains pending.

## Features and scope

- Host workspace with My Events, incomplete drafts, editing, private poster uploads and separate submission.
- Event description/category, venue/address/city, Dhaka session times, BDT ticket price and capacity.
- Admin review queue, required correction feedback, resubmission, approval/publication and review history.
- Pending events are read-only. Saving published edits withdraws them atomically; stale/concurrent decisions return 409.
- Public homepage catalogue, title/category/city/date filters, URL persistence, bounded pagination, starting prices and refreshable details.
- Server identity checks, protected database roles, RLS, restricted grants, transactional writes and immutable private Storage objects.
- JSON APIs shared by the website and a future Flutter client.

**F1 and the Division 2 F17 event moderation workflow are implemented. F5 remains partial:** price/availability filters and full sorting requirements remain. Separate venue/session/ticket records are **F2–F4 foundations only**. The first editor handles one session and ticket category. Sprint 2 Division 1 adds seating and pending reservations; payment and Flutter screens remain outside the current implementation. See the [reservation handoff](docs/sprint-2-division-1.md) for setup and verification status.

## Architecture

Next.js 16 App Router, Node.js Route Handlers, TypeScript, React 19, Tailwind CSS 4, shadcn/ui and Supabase PostgreSQL/Auth/Storage.

| Layer              | Location                                  |
| ------------------ | ----------------------------------------- |
| Views              | `src/app`, `src/components`               |
| Controllers        | `src/controllers`                         |
| Business workflows | `src/services`                            |
| Persistence        | `src/repositories`, `supabase/migrations` |

Authorization never trusts client-submitted roles, owner IDs or editable Auth metadata. The application uses a publishable key and caller identity, with no service-role key. Public output excludes organizer contacts and moderation notes.

## Run locally

Use Node **22.23.4** from `.nvmrc` or supported Node **24 LTS**.

```powershell
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
```

The ignored local configuration needs:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
APP_URL=http://127.0.0.1:3000
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). This checkout is configured for the existing development project. Its migrations are already applied: do not reapply creation SQL or reset the database. For a separate project, apply all migrations in order. See [setup](docs/setup.md) for Auth and administrator bootstrap. Email confirmation remains disabled for this development project.

If Node is missing from PATH in this Windows workspace, the verification runtime is in ignored `.qa/node-v24.11.0-win-x64`:

```powershell
$env:PATH = (Resolve-Path '.qa/node-v24.11.0-win-x64').Path + ';' + $env:PATH
npm run dev
```

## Verification

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e -- --workers=2
```

The [Division 2 report](docs/sprint-1-division-2.md) records actual results and opt-in hosted integration/browser commands. Mocked identity and embedded PostgreSQL tests are distinguished from real Supabase tests; skipped suites are not passes. Run a production build before browser checks and free port 3000 first. Reports, credentials and local configuration remain ignored.

## Faculty demonstration

Use separate approved-host and admin browser profiles, plus an incognito visitor.

1. At `/host`, create **Dhaka Unplugged**. Save only the title, leave, and reopen to show draft persistence.
2. Complete a Concert event in Dhaka with a future Dhaka schedule, poster, **BDT 500 General Admission** ticket and positive capacity. Save, then submit separately.
3. At `/admin/events`, request an entrance clarification with feedback.
4. As host, show the feedback, correct the address, save, and resubmit.
5. As admin, approve and publish. As visitor, combine title/category/location/date filters at `/events`, open the result, show the price, and refresh its URL.
6. Open the host editor to show publication is unchanged; save an edit and demonstrate disappearance from search and the unavailable screen at the old public URL.

Full instructions: [Division 2 handoff](docs/sprint-1-division-2.md).

## Documentation

| Document                                           | Purpose                                                        |
| -------------------------------------------------- | -------------------------------------------------------------- |
| [Division 2 progress](docs/sprint-1-division-2.md) | Scope, migrations, verification and faculty demo               |
| [Event JSON API](docs/division-2-api.md)           | Endpoints, payloads, errors, permissions and publication rules |
| [Division 1 handoff](docs/sprint-1-division-1.md)  | Historical account and host-verification record                |
| [Account/host API](docs/api.md)                    | Existing Division 1 contract                                   |
| [Setup](docs/setup.md)                             | Auth, bootstrap and future Vercel connection                   |
| [Architecture](docs/architecture.md)               | Original MVC mapping                                           |
| [Assets](docs/assets.md)                           | Imagery and font provenance                                    |

The image in `docs/images/homepage.png` is the historical Division 1 interface, not the current catalogue. The interface continues to evolve.

**Maintainer:** [Rifat Sadeq Priyo](https://github.com/rifatpriyo) · **Course:** CSE470

## Sprint 2 Division 1

Session-specific seat selection, an on-demand demo-hall 3D preview, and expiring pending reservations are implemented in this working tree. Read the [Sprint 2 handoff](docs/sprint-2-division-1.md) for the migration, isolated demo setup, API, and actual verification results. Full authenticated reservation acceptance requires the local Supabase setup described there. F8 remains partial; paid confirmation and ticket delivery are not included.
