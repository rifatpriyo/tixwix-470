# TixWix repository instructions

## Current scope

This repository implements **Sprint 1, Division 1** only. The next division must be requested separately. Host verification is only part of F17; do not label event moderation complete.

Preserve existing work and unrelated changes. Never reset a shared/production database. Do not commit credentials, `.env.local`, generated browser reports, or privileged keys.

## Architecture and checks

- Next.js App Router with Node.js Route Handlers, TypeScript, React, Tailwind CSS, shadcn/ui, Supabase PostgreSQL and Auth.
- Views live in `src/app` and `src/components`; controllers in `src/controllers`; business workflows in `src/services`; database operations in `src/repositories` and migrations.
- Validate user identity on the server and read roles from the protected database. Never authorize from client-submitted IDs, roles, or editable Auth metadata.
- Use Node from `.nvmrc` or supported Node 24 LTS.
- Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` for relevant changes. Run `npm run test:e2e` after a production build when UI/routes change.
- Distinguish mocked tests, embedded PostgreSQL tests, and actual Supabase integration tests. The real integration suite is opt-in via `SUPABASE_TEST_*` variables; skipped tests are not passes.

## Context7

Use Context7 MCP to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service, including API syntax, configuration, migration, library-specific debugging, setup, and CLI usage. Prefer it over web search for library documentation.

Do not use it for general programming concepts, business logic debugging, code review, refactoring, or scripts from scratch that do not depend on a library/platform API.

1. Start with `resolve-library-id` using the library name and the question, unless the user supplied an exact `/org/project` ID.
2. Pick by name, relevance, snippet coverage, source reputation and benchmark score. Use a version-specific ID when the user specified a version.
3. Call `query-docs` with the selected ID and a specific full question.
4. Use the fetched documentation.
