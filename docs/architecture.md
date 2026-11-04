# Sprint 1 Division 1 architecture

TixWix uses Next.js App Router and React with TypeScript, Tailwind CSS 4, shadcn/ui components, and Supabase PostgreSQL/Auth. The architecture separates presentation, request handling, workflow rules, and storage. This is an explicit MVC-style organization, not a claim of faculty approval of the framework.

| Responsibility      | Location                                          | What it owns                                                                                             |
| ------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Views               | `src/app/**/page.tsx`, `src/components`           | Server-rendered persisted information, forms, navigation, accessibility and UI state                     |
| Controllers         | `src/controllers`, thin `src/app/api/**/route.ts` | JSON boundaries, validation, trusted session lookup, permissions, HTTP statuses, CSRF and error handling |
| Services            | `src/services`                                    | Registration/login/logout workflows, authorization, application submission and review coordination       |
| Repositories/models | `src/repositories`, `src/lib/domain.ts`           | Typed database queries and RPC calls                                                                     |
| Database invariants | `supabase/migrations`                             | RLS, grants, constraints, immutable submissions, review transactions and role assignment                 |

Server-rendered pages call the same service/repository layer rather than making HTTP calls to themselves. Client components only submit form data and display outcomes. Substantive business rules are in services and PostgreSQL routines, not event handlers inside the UI.

## Authentication and authorization

The server calls Supabase `getUser()` to validate identity. It never accepts a user ID or role from a form as authorization. Cookie sessions use `@supabase/ssr` with `getAll`/`setAll`; `src/proxy.ts` refreshes cookies before Server Components render. Route Handlers handle their own refreshes. Cookies are HTTP-only because all browser auth goes through the server; production cookies are Secure and SameSite=Lax.

Every protected operation retrieves roles from `public.user_roles` for that validated user. No role is taken from editable Auth metadata, client storage, or stale JWT role claims. Host approval therefore takes effect on the next request without re-registration or reauthentication. Page checks produce redirects; API/service checks and RLS independently enforce access.

The application needs only a Supabase publishable key. Database requests run as the caller, so RLS remains active. Native clients can obtain/refresh sessions using the Supabase SDK and send a bearer access token to the same business APIs. No Flutter UI is included.

Cookie-authenticated mutations require same-origin JSON. Native bearer requests bypass the browser Origin check only on business endpoints and still undergo identity and role validation. Auth endpoints use the browser cookie contract and always require the configured origin. Payloads are capped at 16 KiB, schemas reject unknown fields, and private/auth responses are marked `private, no-store`.

## Data and state transitions

- `profiles`: one row per Auth user; only `display_name` is writable by its owner.
- `user_roles`: protected additional assignments; customer is created automatically. Ordinary clients have no write grants.
- `host_applications`: immutable submitted details, status and review summary; resubmission creates another row linked through `previous_application_id`.
- `host_application_reviews`: one immutable decision record per reviewed submission, including reviewer UUID, feedback and timestamp.
- `host_profiles`: a snapshot of approved organizer information, created by the approval transaction.

All application tables enable RLS. Customer reads are restricted to ownership, including history and approved-host details. Admins may read applications and histories. There are no direct application mutation policies/grants, including for admins: writes must pass the narrowly scoped RPCs.

`submit_host_application` determines the applicant from `auth.uid()`, locks that applicant's profile, refuses a current pending/approved state or existing host role, and validates input through table constraints. A partial unique index independently prevents duplicate pending submissions. Rejected rows remain intact.

`review_host_application` checks the current admin assignment, locks the same applicant profile then the application row, validates the decision, and writes the application state, review record, host role, and host profile in one transaction. Any failure rolls back all four changes. An identical repeated decision returns the existing application; a conflicting review fails with a conflict. A retry never overwrites the original feedback or reviewer. Rejection requires nonblank feedback and does not grant host access.

Security-definer functions fix `search_path` to an empty string, fully qualify relations, and have explicit execute grants. The initialization/timestamp trigger routines are not callable by ordinary clients. SQL role and ownership checks also apply to clients calling PostgREST directly.

Foreign keys cascade application data on owner deletion. Reviewer references are set to null if a reviewer account is deleted; the decision, feedback, and timestamp remain. Deleting an applicant account intentionally deletes their personal application records. Routine rejection/resubmission never deletes history.

## Scope and verification boundary

The SRS's F17 includes host verification **and** event moderation. This milestone covers host verification only. Event publishing, moderation, inventory, checkout and other SRS features are not exposed as working controls.

PGlite tests execute the real migration and policies but scaffold Supabase's Auth tables/subject function. Mocked tests exercise HTTP and Auth response handling. The opt-in integration suite uses actual Supabase Auth/PostgREST, including concurrent requests. Browser smoke tests without credentials prove only public UI and denied access paths. See the progress document for what was actually executed.

Official implementation references consulted via Context7:

- [Next.js Supabase proxy example](https://github.com/vercel/next.js/blob/canary/examples/with-supabase/proxy.ts)
- [Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- [Supabase SSR](https://github.com/supabase/ssr)
- [Supabase server-side authentication](https://supabase.com/docs/guides/auth/server-side)
- [Supabase RPC response modifiers](https://supabase.com/docs/reference/javascript/rpc)
- [shadcn/ui component configuration](https://ui.shadcn.com/docs/components-json)
