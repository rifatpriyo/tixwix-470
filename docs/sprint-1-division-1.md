# Sprint 1 Division 1 progress

**Project version: 0.1** (`0.1.0` in package metadata).

Implementation verification record: 4 November 2026 (Asia/Dhaka). Documentation refreshed: 5 November 2026.

The implementation covers the requested account-to-approved-host workflow and is published in [rifatpriyo/tixwix-470](https://github.com/rifatpriyo/tixwix-470). Development project `euuastddghdsyodcnfhp` is now connected. Its empty database was inspected before applying the Division 1 migration through the official Supabase CLI; migration history records `202611040001`. No existing records were reset or removed. Vercel deployment and email delivery remain unverified.

At the owner's explicit request, email confirmation is disabled for local testing. New accounts can sign in immediately. The hosted Site URL is `http://127.0.0.1:3000`, both loopback hostnames have callback/confirmation redirects, and the minimum password length is eight characters. The ignored `.env.local` holds the publishable key. Privileged test keys are read into the test process environment only and are not written to application configuration or Git.

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
- GitHub source on `main` and `feature/sprint-1-division-1`. Commits use Rifat Sadeq Priyo's configured Git author and committer identity, with no Codex co-author trailers or contribution badges. No hosted deployment has occurred.

## Verification evidence

Commands used the isolated Node 22.23.4 runtime because the host's Node 22.11.0 is too old for current test/lint tooling:

```powershell
npx.cmd --yes --package=node@22.23.4 node node_modules/eslint/bin/eslint.js .
npx.cmd --yes --package=node@22.23.4 node node_modules/typescript/bin/tsc --noEmit
npx.cmd --yes --package=node@22.23.4 node node_modules/vitest/vitest.mjs run
npx.cmd --yes --package=node@22.23.4 node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts
npx.cmd --yes --package=node@22.23.4 node node_modules/next/dist/bin/next build --webpack
npx.cmd --yes --package=node@22.23.4 node node_modules/@playwright/test/cli.js test
npx.cmd --yes --package=node@22.23.4 node node_modules/@playwright/test/cli.js test --config playwright.live.config.ts
```

| Check                                  | Result                          | What it proves                                                                                                                                                           |
| -------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ESLint                                 | Passed                          | Source lint, TypeScript recommendations, Next.js and React Hooks rules                                                                                                   |
| TypeScript                             | Passed                          | Strict application/test type checks                                                                                                                                      |
| Unit + embedded PostgreSQL tests       | 29 passed across 5 files        | Validation, mocked Auth/callbacks/controllers, and actual PostgreSQL policy/transaction tests                                                                            |
| Real Supabase integration suite        | 3 passed                        | Actual Auth login/session reuse/logout, concurrent RPCs, approval, resubmission, RLS and protected writes                                                                |
| Next.js production build               | Passed                          | All requested routes compile and produce a production server bundle                                                                                                      |
| Chromium desktop/mobile smoke suite    | 10 passed                       | Public UI, responsive layouts, denied-access paths, CSRF and callback errors                                                                                             |
| Live Chromium account-to-host workflow | 1 passed                        | Real registration, immediate sign-in, persisted browser session, logout, invalid/valid login, application submission, admin approval and host access on the same account |
| Production dependency audit            | Passed, zero vulnerabilities    | `npm audit --omit=dev`                                                                                                                                                   |
| Full dependency audit                  | 12 moderate, zero high/critical | Development-tool transitive `minimatch` glob-amplification advisory; no production dependencies affected                                                                 |

The embedded database tests execute the exact migration on PGlite PostgreSQL, not a mocked persistence adapter. They test registration-trigger role protection, ownership isolation, duplicate pending constraints, admin-only review, atomic approval rollback, retry idempotency, rejection feedback, resubmission/history retention, forbidden direct writes, ordinary profile edits and anonymous/host authorization. The Auth schema and JWT subject helper are scaffolding; this is not a hosted Supabase project, PostgREST instance, or a real multi-connection concurrency test.

Desktop and mobile landing/registration screenshots were visually inspected. No clipping or horizontal overflow was found. Browser tests use an explicit canonical local origin; the application alert is scoped separately from Next.js's accessibility route announcer.

Auth unit tests use mocked Supabase responses. They verify both email-confirmation modes, callback behavior, failure handling and logout coordination, but cannot establish real SMTP delivery. The opt-in integration suite has now passed against the hosted project using actual Auth, PostgREST, RLS and concurrent RPCs; its accounts were provisioned through the Admin API and removed afterward. The separate live browser suite exercises the application registration form with immediate sign-in. Email delivery and the live confirmation-enabled flow still require SMTP/mailbox verification before release.

The live browser workflow passed against the production Next.js build connected to the hosted development project. It used the real registration form, verified a customer-only profile and API restrictions, reloaded the authenticated dashboard, signed out, rejected an incorrect password, signed back in, submitted a host application, approved it through a separate administrator browser context, and verified host access while retaining the original user ID. Both temporary accounts and their application data were removed after the test. No test passwords, service-role keys, traces, or browser recordings were committed.

The remaining development-tool audit finding is [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). No unsafe cross-major overrides or automatic force downgrade were applied. Review upstream lint tooling releases before expanding CI to process untrusted glob inputs.

## Exact remaining setup

1. Use Node 22.23.4 or supported Node 24 LTS locally, then `npm ci`.
2. The development project's migration, API connection and local redirect configuration are complete. Other checkouts need their own ignored `.env.local`.
3. Before public release, configure SMTP, enable email confirmation, and verify confirmation delivery using a real mailbox.
4. Use the configured local application for customer registration and sign-in; new accounts currently sign in immediately.
5. Register and confirm the intended administrator, verify its Auth UUID, and execute the guarded bootstrap script as project owner.
6. Re-run the opt-in integration/live-browser suites when auth or database behavior changes. Use a development/test project; never expose its service-role key in application variables or client code.
7. Link a Vercel project to the published source, configure Preview environment variables and redirects, deploy with `--target=preview`, and verify the actual returned preview URL.

No preview URL exists yet. Setup details and commands are in the [setup and verification guide](setup.md); the [README](../README.md) provides the project overview and faculty demonstration sequence.

## Scope and course documentation

This milestone is **Sprint 1, Division 1**, not all of Sprint 1 and not all of F17. Event moderation, publishing, discovery, venues, scheduling, pricing, bookings and Flutter remain for later instructions. There are no fabricated sales counts, events or disabled controls pretending those workflows exist.

The version 0.1 interface and README screenshot show the current development state, not the final visual design. Extensive work on the UI and user experience is planned for later iterations; the current milestone focuses on functional account and host-onboarding workflows.

The supplied SRS was read as product reference; its old Vue/Laravel direction and stack restriction were superseded by the explicit request. The original Word file was not edited. MVC responsibilities are documented for faculty review without claiming approval. The team still needs to record its own contributions, demonstrate understanding, and accurately disclose AI assistance in the course submission.
