# Supabase and API security review — 2026-10-10

Reviewed the repository's migrations, server database clients, API handlers, published creator/sponsorship reads, wallet sessions, and CORS responses. Validation uses isolated PostgreSQL/PostgREST and a real Next.js production server/browser. This review does not certify the deployed project's current grants, policies, Storage configuration, hosting environment, or key rotation history; no live database configuration was changed.

## Findings and fixes

| Area | Finding | Result |
| --- | --- | --- |
| Public sponsorship data | Public GET returned `sponsor_profiles.*` and included the active campaign's `payment_signature`. The UI does not need that proof. | Explicit query and response projections remove payment proofs, campaign wallet data, internal timestamps, future columns, and unsupported design JSON properties. |
| RLS and grants | Existing migrations enable RLS and revoke browser access to private tables. However, inherited `PUBLIC` grants and migration-owner default privileges were not comprehensively hardened. Schema-only function revokes cannot override PostgreSQL's global EXECUTE default. | Migration 012 explicitly closes current table/RPC access, removes untrusted schema CREATE, and hardens both global and schema-specific defaults. |
| Privileged database calls | The app had duplicate service-role client factories. The key bypasses RLS, so application authentication and row scoping remain essential. | App and sponsorship clients now share `appDb()`, which disables Supabase session persistence/refresh and refuses browser execution. Client import regression checks reject privileged modules and secret environment variables. |
| SQL routines | Sponsorship activation/review and tip summary used SECURITY DEFINER despite being service-role-only calls. The update trigger also retained default public EXECUTE. | Application routines use SECURITY INVOKER, a pinned `public, pg_temp` search path, and service-role-only EXECUTE. Existing service-role writes and RPCs remain functional. |
| Storage | Public creator images are intentional, but permissive Storage policies could also grant direct listing or mutations. | Restrictive bucket-specific policies block browser roles from creator image metadata/listing and writes, even alongside permissive policies; other buckets retain their policies. |
| Session transport | Cookies had the correct flags for HTTPS, but a non-loopback HTTP production origin could issue insecure cookies. | Startup/build environment validation and runtime cookie creation reject non-HTTPS production origins. Loopback HTTP remains available for local tests. |
| Challenge expiry | Sponsorship challenge expiry was checked when read, but not at atomic consumption. | Challenge deletion is bound to both wallet and an unexpired timestamp, rejecting expiry during verification. |

## Verified boundaries

All 13 application tables have RLS enabled and deny direct SELECT/INSERT/UPDATE/DELETE access to `anon`, `authenticated`, and an unrelated role inheriting `PUBLIC`. Private tables cover cards, sponsorship profiles/requests/challenges, wallet nonces/sessions, tips, alias registration intents, image cleanup, rate limits, and monitoring records. Browser roles cannot execute application RPCs. The service role receives SELECT/INSERT/UPDATE/DELETE and necessary function EXECUTE, with unnecessary table TRUNCATE/REFERENCES/TRIGGER grants removed. [Supabase documents that secret keys bypass RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), which is why these server endpoints still enforce wallet ownership themselves.

Cookie-authenticated writes require the configured exact Origin and a live wallet session. Sponsorship writes additionally verify a single-use signature over the origin, action, wallet, payload hash, and nonce; creator operations check alias/campaign ownership. Profile updates scope writes to the verified owner, not a caller-supplied wallet. Registry claim operations require the signed-in wallet; legacy/public payment operations use verified transaction signatures and receipts.

Session tokens are random 256-bit opaque values and only hashes are stored. Cookies are HttpOnly, SameSite=Lax, Path=/, host-only (no Domain), and Secure for HTTPS. Session expiry is filtered in database reads. Sign-in consumes an unexpired browser-bound nonce once; replacing a session revokes the prior token, and logout deletes the stored token hash. Browser checks confirm JavaScript cannot read the session cookie and an explicitly replayed logged-out cookie no longer authorizes reads.

Private APIs do not advertise cross-origin access or credentialed CORS. Public Solana Action endpoints intentionally use `Access-Control-Allow-Origin: *` without `Access-Control-Allow-Credentials`; arbitrary Blink clients can build or confirm cryptographically authorized payments. Cookie-authenticated registry claims still enforce Origin/session ownership regardless of their Action headers. CORS is a browser response policy, not the application's authorization mechanism.

Anonymous creator reads require `published=true`; an unpublished card can only be previewed through a verified owner session. Public wallet-to-alias lookup intentionally exposes only username and recipient wallet, including claimed but unpublished aliases. Dashboard tip history is owner-only, and payer fields are omitted unless the creator enables them. Sponsorship offers and active ad copy are separately published surfaces; they do not expose private card drafts, private campaign ledgers, or payment signatures. Public sponsorship responses now re-project both rows and design JSON.

## Public media and deployment limits

`creator-images` remains a public bucket: anyone with a direct object URL can retrieve its bytes, including after a card is unpublished. RLS restrictions on metadata/listing do not make those bytes private. This is the existing public-media design, and files should not be treated as confidential. [Supabase distinguishes public serving from controlled listing/upload/delete operations](https://supabase.com/docs/guides/storage/buckets/fundamentals). Sponsorship offers are also independently published; unpublishing a creator card does not delete its offer.

Apply `front/supabase/migrations/012_security_boundaries.sql` after 011 before relying on the database hardening. Its restrictive Storage policies are installed only when managed Storage tables exist. Existing object owners must run the migration with sufficient ownership privileges. Default privilege changes apply to the migration owner; other roles creating future tables/functions need equivalent defaults. Function/table global defaults for that owner now fail closed, so future intentionally public objects require explicit grants. [PostgreSQL explains inherited grants and REVOKE semantics](https://www.postgresql.org/docs/current/sql-revoke.html).

Keep the service secret and operator tokens server-only. Confirm the deployed Origin uses HTTPS, audit live grants/policies against migration 012, confirm the managed Storage policies exist, and inspect public responses before production promotion. The repository tests prove the intended configuration, not an already-deployed configuration.

## Reproducible validation

From `front`:

```sh
npm run test:security:db
E2E_TEST_PATTERN=security-boundaries.spec.ts npm run test:e2e
VYNX_ALIAS_REGISTRY_ENABLED=false node --import tsx --test --test-concurrency=1 tests/*.test.mjs
npm run lint
npm run typecheck
npm run build
```

Database tests apply every migration, simulate inherited PUBLIC grants and stale permissive Storage policies, and check RLS, RPC access, service-role functionality, schema CREATE restrictions, and future default privileges. Browser/API tests exercise anonymous projections, unpublished draft protection, HttpOnly cookies, cross-origin mutation rejection, nonce replay, logout revocation, and public/private CORS. Unit tests cover HTTPS cookie enforcement, atomic challenge expiry, public response allowlists, malformed session tokens, and the client import graph.
