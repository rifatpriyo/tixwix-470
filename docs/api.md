# Division 1 JSON API

All routes execute in the Node.js runtime. Private responses use `Cache-Control: private, no-store`. Requests and responses are JSON except for email callbacks, which redirect.

For browser mutations send `Content-Type: application/json` and same-origin requests; cookies are managed by the server. The allowed origin is `APP_URL`, falling back to `https://VERCEL_URL` on Vercel. For a future native client, authenticate and refresh tokens with Supabase Auth, then send `Authorization: Bearer ACCESS_TOKEN` to the business APIs. Native clients must store tokens securely. Browser login/register routes return session cookies, not access/refresh token JSON.

| Method | Path                                                 | Access                 | Request / response                                                                                     |
| ------ | ---------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------ |
| POST   | `/api/auth/register`                                 | Visitor, same origin   | `{display_name,email,password}` → 201, `authenticated` plus `redirect` or email-confirmation `message` |
| POST   | `/api/auth/login`                                    | Visitor, same origin   | `{email,password}` → `authenticated`, `redirect` and session cookies                                   |
| POST   | `/api/auth/logout`                                   | Same-origin browser    | `{}` → clears current session cookies and returns `redirect`                                           |
| GET    | `/auth/callback?code=...`                            | PKCE callback          | Exchanges code; redirects to dashboard or a safe login error                                           |
| GET    | `/auth/confirm?token_hash=...&type=email`            | Signup email callback  | Verifies token hash; redirects to dashboard or safe login error                                        |
| GET    | `/api/me`                                            | Authenticated          | `{user:{id,email,roles},profile}`                                                                      |
| PATCH  | `/api/me`                                            | Authenticated owner    | `{display_name}` → `{profile}`; protected fields are rejected                                          |
| GET    | `/api/host-applications`                             | Authenticated          | Own `{application,applications,reviews}`; current application is null before first submission          |
| POST   | `/api/host-applications`                             | Authenticated non-host | `{organizer_name,contact_email,contact_phone,description}` → 201 `{application}`                       |
| GET    | `/api/host`                                          | Approved host          | `{host}` with the caller's approved organizer information                                              |
| GET    | `/api/admin/host-applications?status=pending&page=1` | Administrator          | `{applications,total,page,pageSize}`; status: pending, approved, rejected or all; 20 rows/page         |
| GET    | `/api/admin/host-applications/:id`                   | Administrator          | Selected `{application,applications,reviews}` including the applicant's previous submissions           |
| POST   | `/api/admin/host-applications/:id/review`            | Administrator          | `{decision:"approved"                                                                                  | "rejected",feedback?:string}`→`{application}` |

Application fields are trimmed on the server. Organizer name is 2–120 characters, contact email at most 254 characters, phone 7–15 digits with optional leading plus/spaces/parentheses/hyphens (maximum 25 characters), and description 30–2,000 characters. Rejection requires nonblank feedback of at most 2,000 characters. Passwords have a local minimum of 8 characters and maximum of 128; stricter Supabase settings are also honored. Unknown fields are rejected.

The customer application endpoint never accepts an applicant ID. The server derives ownership from a validated session, and the submission RPC derives it again from `auth.uid()`. Editing a rejected application means submitting corrected details to the same POST endpoint; the database creates a new pending row and preserves the old submission.

Errors use `{error:string,code?:string,fields?:Record<string,string[]>}`. Common statuses: 400 malformed request/auth error; 401 missing/invalid identity; 403 insufficient role or invalid origin; 404 unknown application; 409 pending/already-reviewed conflict; 413 oversized body; 415 unsupported content type; 422 invalid fields; 429 auth provider rate limit; 503 missing setup/unavailable account service. No upstream secret or stack trace is returned.

Repeated approval or rejection with the same decision is idempotent; the original feedback remains authoritative. A different decision on an already reviewed row returns 409. The UI disables duplicate submits, but the transaction and unique indexes remain the final safeguards.
