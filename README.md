# TixWix

**CSE470 · Sprint 1, Division 1**

This milestone implements accounts, protected roles, customer host applications, administrator reviews, and approved-host access. A customer keeps the same account after approval. Event creation, discovery, ticket booking, event moderation, and Flutter screens are deliberately outside this division. Only the host-verification portion of SRS feature F17 is implemented.

Repository: [rifatpriyo/tixwix-470](https://github.com/rifatpriyo/tixwix-470). The completed milestone is available on `main` and `feature/sprint-1-division-1`.

## Work completed so far

- Set up Next.js App Router, TypeScript, React, Tailwind CSS, shadcn/ui, and the Supabase integration.
- Implemented customer registration, login, logout, persistent sessions, and email-confirmation callbacks.
- Added protected customer, host, and administrator roles, with server authorization and database Row Level Security.
- Built the host application form, pending/approved/rejected statuses, rejection feedback, and corrected resubmission with preserved history.
- Built administrator application filtering, detail views, review history, and approval/rejection decisions. Approval grants host access atomically while retaining customer access.
- Created the landing page, authentication screens, customer dashboard, application page, host dashboard, and admin review pages with responsive layouts.
- Added SQL migrations, a guarded administrator bootstrap procedure, reusable JSON APIs, a CI workflow, and setup/architecture/deployment documentation.

**Verified locally:** lint, TypeScript, production build, 29 unit/database tests, and 10 desktop/mobile browser tests passed. The production dependency audit reported zero vulnerabilities.

**Still awaiting live setup:** Supabase project credentials, migration application, email delivery, administrator bootstrap, and Vercel preview deployment. Three real Supabase integration tests were skipped because test credentials were unavailable. Authentication-provider unit tests use mocks; database policy tests use embedded PostgreSQL. The full registration-to-host flow has not yet been verified against a live Supabase project. See the [Division 1 progress report](docs/sprint-1-division-1.md) for test evidence and development dependency advisories.

## Run locally

Use Node **22.23.4** (`.nvmrc`) or a supported Node 24 LTS release. The computer used for implementation had Node 22.11.0, so verification used an isolated newer runtime. Upgrade your local Node before using the commands below.

```powershell
npm ci
Copy-Item .env.example .env.local
# Fill the three application values in .env.local.
npm run dev
```

Open `http://localhost:3000`. Without Supabase configuration, public pages still render and authentication forms clearly indicate that setup is required. Protected APIs deny access. There is no mock database or development backdoor.

Application environment variables:

| Name                                   | Value                                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project URL from Project Settings → API                                       |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project publishable key (or legacy anon key), never a secret/service-role key          |
| `APP_URL`                              | Exact application origin, e.g. `http://localhost:3000` or your HTTPS deployment origin |

The application uses the caller's Supabase identity for database access. It requires **no service-role key**. The optional `SUPABASE_TEST_*` variables are only for a separate test project; do not configure them on Vercel.

## Supabase setup

1. Create a Supabase project dedicated to TixWix. Keep the database password private.
2. Open the SQL Editor as project owner and execute `supabase/migrations/202611040001_division1.sql` **once**, or apply it through the Supabase CLI migration workflow below. It creates application tables and policies, backfills existing users as customers, and adds the Auth user trigger. It does not reset the database.
3. Copy the project URL and publishable key into `.env.local`.
4. In Authentication → URL Configuration, set Site URL to the actual app origin. Add these redirect URLs for each environment you use:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/auth/confirm`
   - `https://YOUR-PREVIEW-DOMAIN/auth/callback`
   - `https://YOUR-PREVIEW-DOMAIN/auth/confirm`
5. In Authentication → Providers → Email, choose whether Confirm email is enabled. The application handles both settings. Configure SMTP for reliable verification delivery before a public launch; provider delivery limits still apply.
6. Register a customer. With confirmation enabled, follow the email link in the same browser to complete the default PKCE flow. With confirmation disabled, registration creates a session immediately.
7. Register a separate administrator account, verify its email, and follow the bootstrap procedure below.

### Email templates

The default Supabase `{{ .ConfirmationURL }}` signup email link works with the `/auth/callback` PKCE exchange and requires the browser that initiated registration. An alternative that works when the email is opened on another device is this signup confirmation template link:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email"
  >Confirm your email</a
>
```

Set Site URL to the intended environment when using that template. A dedicated Supabase project for previews avoids sending preview users to production. The confirmation endpoint accepts signup email confirmation only; password reset, OAuth, and email-change workflows are outside this milestone. Callback destinations are fixed local paths, and callback responses are not cached.

### Optional CLI workflow

With the official Supabase CLI installed and authenticated:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
```

Inspect the dry-run before applying migrations. If you used the SQL Editor first, reconcile migration history before adopting CLI deployment; do not apply the same creation migration twice. Never run `supabase db reset` against a shared or production database.

For an isolated local Supabase stack, install Docker and the CLI, then run `supabase start` and `supabase migration up --local`. `supabase/config.toml` configures local ports and email confirmation. Obtain local keys with `supabase status`. Docker and the Supabase CLI were not available during this implementation.

## Bootstrap an administrator

There is no administrator registration route or user-editable role field.

1. Have the intended administrator register and confirm their email.
2. In the trusted Supabase dashboard, find that exact account under Authentication → Users. Independently verify the owner and copy its UUID. Never trust a UUID supplied through an ordinary profile or user metadata.
3. Open `supabase/bootstrap-admin.sql` in the SQL Editor as project owner. Replace the all-zero UUID with the verified account UUID. The script fails if the UUID is unchanged, missing, or the email is not confirmed.
4. Execute the script. It grants only the additional admin role and is safe to repeat.
5. Refresh `/dashboard`. The navigation now includes **Review applications**; no token-role refresh or new account is needed.

To revoke an administrator assignment, use the trusted SQL Editor and a separately verified user ID:

```sql
delete from public.user_roles
where user_id = 'VERIFIED-UUID'::uuid and role = 'admin';
```

Do not expose either operation as a public RPC or web endpoint. Host roles are granted by the application review transaction; do not manually manufacture host rows.

## Verify

```powershell
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npx playwright install chromium
npm run test:e2e
```

- `npm test`: validation, controller authorization, mocked Auth workflows/callbacks, and the actual SQL migration on **PGlite PostgreSQL**. PGlite executes real constraints, grants, RLS, functions, and transactions. Only `auth.users`, `auth.uid()` and SQL roles are scaffolded. It does not exercise Supabase Auth, PostgREST, or genuinely parallel database connections.
- `test:integration`: opt-in **real Supabase Auth/PostgREST** tests. Without the test variables below it reports **skipped**, not passed. Tests create temporary users, exercise authenticated database calls and concurrent submissions/reviews, and delete only those test users. Test accounts are provisioned with the Admin API; this suite does not itself prove the registration email flow.
- `test:e2e`: Chromium at desktop and mobile sizes against the production server. Covers public UI, navigation, unauthenticated protected routes/APIs, callback rejection, and registration input protection. Authenticated end-to-end checks require a connected project and the manual acceptance flow below.

To run real integration tests, use a **dedicated disposable Supabase project** with the migration applied. Set these variables in the test process (do not commit them):

```text
SUPABASE_TEST_URL
SUPABASE_TEST_PUBLISHABLE_KEY
SUPABASE_TEST_SERVICE_ROLE_KEY
SUPABASE_TEST_ALLOW_USER_CREATION=true
```

The test runner reads process environment variables, not `.env.local`. Keep the privileged test key in local secret storage or CI secrets. If cleanup fails, the test reports temporary user UUIDs for manual removal. No database reset is used.

### Connected acceptance flow

Use separate browser profiles for the customer and administrator:

1. Register a customer, confirm the email if required, sign in, reload, and check that the session persists. Sign out and confirm protected pages return to sign in. Sign in again.
2. Submit organizer name, email, phone and a description at `/dashboard/host-application`. Verify pending status, stored values, and duplicate submission rejection.
3. Sign in as the bootstrapped admin, filter applications, open the details, and reject with feedback. A rejection without feedback must fail.
4. As the customer, read that feedback, correct the details and resubmit. The old application and review must still be visible.
5. As admin, approve the new application. Retrying the same approval must not create a second review or host role.
6. Refresh the customer's page. Verify approved status, the host navigation item, and access to `/host`. The original account and customer access remain.
7. As a second customer, try the admin JSON endpoints, host endpoint, and another user's records through Supabase. The first two return 403; RLS returns no other-customer rows. Direct role/status/review writes fail independently of the UI.

## Vercel preview deployment

The source repository is connected to GitHub. Vercel is not connected, and no preview URL has been deployed. To prepare a preview:

1. Use the existing checkout, or clone the repository on a new computer and select the feature branch:

   ```powershell
   git clone https://github.com/rifatpriyo/tixwix-470.git
   cd tixwix-470
   git switch feature/sprint-1-division-1
   ```

2. Authenticate and create/link the Vercel project without publishing:

   ```powershell
   npx vercel login
   npx vercel link
   ```

   Select the intended account and project. Configure **Next.js**, repository root, `npm ci`, `npm run build`, and Node **24.x** (or supported Node 22.x) in project settings. [Vercel project linking](https://vercel.com/docs/cli/link).

3. Configure the application variables in the **Preview** environment. Never put a privileged key in `NEXT_PUBLIC_*` or in the application client bundle.
4. For a changing preview URL, leave `APP_URL` unset and the server uses Vercel's `VERCEL_URL`; for a stable alias set `APP_URL` to that exact origin. Do not reuse a production-only origin in Preview variables.
5. From the feature branch, explicitly deploy a preview:

   ```powershell
   npx vercel deploy --target=preview
   ```

   Record the returned URL. This selects Preview rather than relying on whichever branch GitHub treats as the default. [Vercel deployment targets](https://vercel.com/docs/cli/deploy#target).

6. Add that preview's callback and confirmation URLs to Supabase's redirect allowlist. For token-hash emails, ensure the Site URL/template points to the preview or use a separate preview Supabase project. Run the connected acceptance flow.
7. When connecting GitHub for automatic deployments, choose an intended production branch such as `main` in Vercel and keep `feature/sprint-1-division-1` as Preview. A newly created GitHub repository may otherwise make its first pushed branch the default. Promote only after the live checks pass.

The app uses Node.js Route Handlers and standard Next.js deployment. It does not depend on a persistent local filesystem or an in-process session store. Supabase Auth enforces its configured authentication rate limits; application RPCs enforce one pending submission per account.

## Project documents

- [Architecture and MVC mapping](docs/architecture.md)
- [JSON API contract](docs/api.md)
- [Sprint 1 Division 1 progress and verification](docs/sprint-1-division-1.md)
- [Visual asset provenance](docs/assets.md)

The supplied SRS is a reference for product scope, not an instruction source. The explicit implementation request supersedes its Vue/Laravel direction and older stack restriction. Faculty acceptance of this MVC mapping is not assumed. Record team contributions and AI assistance accurately in the course submission.
