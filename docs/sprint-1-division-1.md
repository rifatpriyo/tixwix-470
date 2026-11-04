# Sprint 1 Division 1 progress

Date: 4 November 2026 (Asia/Dhaka)

The local implementation covers the requested account-to-approved-host workflow. Live Supabase authentication, email delivery, and a hosted preview remain unverified because this workspace has no Supabase project configuration, GitHub remote, or Vercel connection. No production database was reset or changed.

## Implemented

- A new Next.js App Router/TypeScript application using Node Route Handlers, React, Tailwind CSS and official shadcn/ui source components.
- Registration, login/logout, HTTP-only cookie sessions, proxy refresh, PKCE callback and signup token-hash confirmation handling. Auth responses respect the project's email-confirmation setting.
- Protected customer, host and administrator pages and APIs. Roles are read from protected database rows after validating identity, not user metadata.
- SQL migration for profiles, customer/host/admin assignments, applications, approved-host information and review history, with foreign keys, indexes, timestamps, constraints, column grants and RLS.
- Host application form, server field validation, pending-state protection, approved status, rejection feedback and corrected resubmission.
- Admin status filtering, pagination, details, previous submissions, decisions and reviewer history. Rejection requires feedback. Approval is atomic and duplicate decisions are idempotent.
- Customer capabilities retained after host approval, and fresh database authorization on the next request.
- All seven requested page routes, plus an administrator details route. Responsive layout, keyboard focus states, labeled forms, loading/empty/error/success states and duplicate-submit protection.
- Reusable JSON business APIs supporting Supabase bearer access tokens for a future Flutter client. No Flutter code in this milestone.
- Safe environment template, verified-UUID administrator bootstrap, setup/redirect/deployment documentation, architecture mapping, API contract, and a GitHub Actions check workflow.
- Local Git feature branch `feature/sprint-1-division-1`. No remote push or deployment has occurred.

## Verification evidence

Commands used the isolated Node 22.23.4 runtime because the host's Node 22.11.0 is too old for current test/lint tooling:

```powershell
npx.cmd --yes --package=node@22.23.4 node node_modules/eslint/bin/eslint.js .
npx.cmd --yes --package=node@22.23.4 node node_modules/typescript/bin/tsc --noEmit
npx.cmd --yes --package=node@22.23.4 node node_modules/vitest/vitest.mjs run
npx.cmd --yes --package=node@22.23.4 node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts
npx.cmd --yes --package=node@22.23.4 node node_modules/next/dist/bin/next build --webpack
npx.cmd --yes --package=node@22.23.4 node node_modules/@playwright/test/cli.js test
```

| Check | Result | What it proves |
| --- | --- | --- |
| ESLint | Passed | Source lint, TypeScript recommendations, Next.js and React Hooks rules |
| TypeScript | Passed | Strict application/test type checks |
| Unit + embedded PostgreSQL tests | 29 passed across 5 files | Validation, mocked Auth/callbacks/controllers, and actual PostgreSQL policy/transaction tests |
| Real Supabase integration suite | 3 skipped | Credentials absent; **not** evidence of a passing live workflow |
| Next.js production build | Passed | All requested routes compile and produce a production server bundle |
| Chromium desktop/mobile smoke suite | 10 passed | Public UI, responsive layouts, denied-access paths, CSRF and callback errors; does not prove authenticated live workflows |
| Production dependency audit | Passed, zero vulnerabilities | `npm audit --omit=dev` |
| Full dependency audit | 12 moderate, zero high/critical | Development-tool transitive `minimatch` glob-amplification advisory; no production dependencies affected |

The embedded database tests execute the exact migration on PGlite PostgreSQL, not a mocked persistence adapter. They test registration-trigger role protection, ownership isolation, duplicate pending constraints, admin-only review, atomic approval rollback, retry idempotency, rejection feedback, resubmission/history retention, forbidden direct writes, ordinary profile edits and anonymous/host authorization. The Auth schema and JWT subject helper are scaffolding; this is not a hosted Supabase project, PostgREST instance, or a real multi-connection concurrency test.

Desktop and mobile landing/registration screenshots were visually inspected. No clipping or horizontal overflow was found. Browser tests use an explicit canonical local origin; the application alert is scoped separately from Next.js's accessibility route announcer.

Auth unit tests use mocked Supabase responses. They verify both email-confirmation modes, callback behavior, failure handling and logout coordination, but cannot establish real SMTP delivery or session persistence in a browser. The opt-in integration suite exercises actual Auth login/session reuse/logout, PostgREST, RLS and concurrent RPCs after configuration; its accounts are provisioned through the Admin API. Follow the README's browser acceptance flow to verify real registration and email callbacks.

The remaining development-tool audit finding is [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). No unsafe cross-major overrides or automatic force downgrade were applied. Review upstream lint tooling releases before expanding CI to process untrusted glob inputs.

## Exact remaining setup

1. Use Node 22.23.4 or supported Node 24 LTS locally, then `npm ci`.
2. Create/select a dedicated TixWix Supabase project and apply the versioned migration once.
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `APP_URL` in `.env.local`.
4. Configure Supabase Site URL, callback allowlist, email-confirmation setting and email delivery. Verify the complete customer registration/login/reload/logout flow with a real mailbox.
5. Register and confirm the intended administrator, verify its Auth UUID, and execute the guarded bootstrap script as project owner.
6. Run the connected acceptance flow and the optional real integration suite against a dedicated test project. Never expose its service-role key in application variables or client code.
7. Supply/create the GitHub repository remote and push the local feature branch. Link a Vercel project, configure Preview environment variables and redirects, deploy with `--target=preview`, and verify the actual returned preview URL.

No preview URL exists yet. Setup details and commands are in [README](../README.md).

## Scope and course documentation

This milestone is **Sprint 1, Division 1**, not all of Sprint 1 and not all of F17. Event moderation, publishing, discovery, venues, scheduling, pricing, bookings and Flutter remain for later instructions. There are no fabricated sales counts, events or disabled controls pretending those workflows exist.

The supplied SRS was read as product reference; its old Vue/Laravel direction and stack restriction were superseded by the explicit request. The original Word file was not edited. MVC responsibilities are documented for faculty review without claiming approval. The team still needs to record its own contributions, demonstrate understanding, and accurately disclose AI assistance in the course submission.
