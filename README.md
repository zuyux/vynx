<p align="center">
  <img src="logo.svg" alt="VYNX logo" width="136" height="100" />
</p>

<h1 align="center">VYNX</h1>

<p align="center">
  <strong>Creator cards and direct support on Solana</strong><br />
  Claim your alias, publish your profile, and receive tips from fans.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-v0.1.0-2563eb?style=flat-square" alt="Version: v0.1.0" />
  <img src="https://img.shields.io/badge/network-Solana%20devnet-7c3aed?style=flat-square" alt="Network: Solana devnet" />
  <img src="https://img.shields.io/badge/status-MVP-f59e0b?style=flat-square" alt="Status: MVP" />
  <img src="https://img.shields.io/badge/license-AGPLv3-0f766e?style=flat-square" alt="License: AGPLv3" />
  <img src="https://img.shields.io/badge/framework-Next.js-374151?style=flat-square" alt="Framework: Next.js" />
</p>

<p align="center">
  <a href="#local-setup">Quick start</a> ·
  <a href="#creator-and-fan-flow">Creator &amp; fan flow</a> ·
  <a href="#validation">Validation</a> ·
  <a href="#database-setup">Database setup</a> ·
  <a href="#product-scope">Product scope</a> ·
  <a href="#documentation">Documentation</a>
</p>

---

## Overview

VYNX is a Solana creator-card application. The current MVP lets creators connect a Phantom wallet, claim an alias, publish a profile, and receive SOL tips.

> **Network:** the MVP supports **Solana devnet only**. Do not use a mainnet wallet RPC or fund the treasury with production SOL.

## Current stack

- Next.js 16 App Router, React 19, and TypeScript
- Tailwind CSS 4, shadcn/ui primitives, and Framer Motion
- Phantom React SDK (`@phantom/react-sdk` and `@phantom/browser-sdk`)
- Solana Web3.js
- Supabase Postgres and SSR helpers
- Vercel deployment

New claims use the deployed devnet Anchor registry, with 1–30 character aliases, on-chain configurable prices and VYNX-sponsored network fees. Supabase stores profiles and registration receipts; both on-chain ownership PDAs authorize profile access. Existing database-only aliases remain reserved and need migration before editing. Apply migration 006 and configure the server-only sponsor key before serving claims. See [registry integration](docs/alias-registry-integration.md).

## Prerequisites

- Node.js 22.14 or newer
- npm 10 or newer
- A Supabase project
- Phantom browser extension (a Portal app ID is optional for Google/Apple login)
- A Solana devnet RPC URL and a devnet treasury wallet

## Local setup

The web application lives in `front/`.

```bash
git clone https://github.com/zuyux/vynx.git
cd vynx/front
cp .env.example .env.local
npm ci
```

Fill every value in `.env.local` using the comments in `.env.example`, then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Configuration is validated before Next.js starts; a missing, placeholder, malformed, or known non-devnet value produces a list of actionable errors.

Supabase configuration uses server-only `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SECRET_KEY`. The app accesses the database through server APIs. Never commit `.env.local`. `SUPABASE_SECRET_KEY` is server-only and deliberately does not use the `NEXT_PUBLIC_` prefix. Values prefixed with `NEXT_PUBLIC_` are bundled into browser code and must not contain secrets.

## Validation

Run the same frontend checks used by CI:

```bash
cd front
npm run check
```

This runs environment validation, ESLint, TypeScript, unit tests, and a production build. Pull requests also run the browser end-to-end suite:

```bash
cd front
npx playwright install --with-deps chromium
npm run test:e2e
# With chain/target/deploy/vynx_alias.so built and chain dependencies installed:
npm run test:e2e:registry
```

The end-to-end runner requires Docker. It starts disposable Postgres and PostgREST containers, applies all migrations, builds the app with isolated test credentials, and runs Chromium. Test wallets create real Ed25519 signatures; a deterministic local Solana RPC fixture validates and parses signed transactions. This tests the browser → application APIs → database → response flow without an extension, external faucet, paid transactions, or production data. The suite covers claim → edit → publish → public page → tip → dashboard → logout, plus rejected signatures, cancellation, expired/replayed sessions, ownership, publication privacy, image/social persistence and mobile layout. It does not broadcast transactions to live devnet.

For the Chrome, Firefox and WebKit desktop/mobile matrix, run `npm run test:browsers`. Setup, coverage and actual Safari/device limitations are documented in [browser compatibility checks](front/docs/browser-compatibility.md).

The runner removes its containers and network afterward. Browser failure traces are written to `front/test-results/` and the report to `front/playwright-report/`. It builds with test environment values; run `npm run build` again before starting the app with your normal environment.

The [invited-user test kit](docs/invited-user-test/README.md) contains an invitation draft, session script and blocking-feedback record. The study is suspended at the user’s request and has not been run.

## Repository structure

```text
vynx/
├── front/                         # Next.js application
│   ├── app/                       # App Router pages and route handlers
│   ├── components/                # Shared React components
│   ├── lib/                       # Supabase and shared utilities
│   ├── scripts/                   # Environment validation
│   └── supabase/migrations/       # Database schema migrations
├── chain/                         # Anchor alias registry, clients and runtime tests
├── docs/                          # Architecture decisions
└── DEVROAD.MD                     # MVP delivery roadmap
```

## Database setup

Apply the SQL migrations in `front/supabase/migrations/` to the configured Supabase project in filename order. Migration `004_wallet_profile_tips.sql` adds wallet challenges, revocable sessions, persistent creator designs and publication settings, claim verification details, and verified tip records. It also carries existing wallet-owned sponsorship designs into creator cards. Apply it after 001–003 before running the new authenticated flow. Browser database clients cannot read private profiles, sessions, challenges or tips; server APIs return the supported public projections.

Migration `006_alias_registry.sql` adds durable sponsor reservations, registry receipt fields and 1–30 character name constraints. It is required for new registry claims.

A Supabase service key can access the application tables but cannot apply SQL migrations. Use the Supabase SQL editor or a database connection with migration privileges.

Apply `005_alias_availability_rate_limit.sql` after 004 to enable rate-limited public alias checks. `GET /api/aliases?alias=alice` returns `{ "alias": "alice", "available": true }` (or `false` for a claimed alias), with `Cache-Control: no-store`. Invalid or reserved names return 400; database failures return 503. Availability checks both database reservations and the alias PDA. It remains advisory; the program enforces unique ownership.

Apply `010_public_endpoint_rate_limits.sql` before deploying mutation/payment rate limiting. All API mutations consume shared, atomic database quotas before body parsing, authentication, or payment work: 10 authentication requests, 20 payment requests, 30 profile/logout mutations, and 60 sponsorship requests per client per 60 seconds. Sponsorship checkout/confirmation also consume the payment quota. Payment builds and confirmations share a quota across app and Solana Action routes, independent of alias or supplied wallet. Exhausted quotas return 429 with `Retry-After`; limiter outages return 503, preserving Action CORS headers. Client IPs are HMAC-hashed using `SUPABASE_SECRET_KEY`; only Vercel's `x-vercel-forwarded-for` is trusted when `VERCEL=1`. Self-hosted requests share a bucket until a trusted ingress identity is configured. The limiter table and RPC are restricted to `service_role`.

API handlers emit one JSON `request_completed` log per request with UTC `timestamp`, `level`, a server-generated `request_id`, static route template, HTTP method, status, duration in milliseconds, and an `unexpected` flag for exceptions that escape the handler. Successful requests use info, 4xx responses use warn, and 5xx responses use error. Responses include `X-Request-Id` for support correlation; Action responses expose it through CORS. Image cleanup/rollback events use the same logger with numeric counters and inherit the current request context. The logger allows only fixed events, route templates, and numeric/boolean fields: it never records request/response bodies, query strings, dynamic aliases, headers, cookies, IPs, wallet addresses, signatures, raw errors, stacks, database URLs, or credentials. Caller-supplied request IDs are ignored. A failed log sink does not interrupt requests. Automatic OPTIONS/preflight responses are excluded from request logging.

Error monitoring adds a protected `POST /api/monitoring/webhook`, `GET /api/monitoring/alerts` inbox, and retryable outbound webhook delivery for API 5xx and payment verification failures. Apply migration `011_error_monitoring.sql`, run `npm run setup:monitoring`, and set server-only `ERROR_MONITORING_ENABLED=true` after applying it. See [error monitoring setup and operations](docs/error-monitoring.md) for authentication, optional notification destinations, retry scheduling, privacy, and isolated database/production HTTP checks.

The [Supabase/API security boundary review](docs/security-boundary-review.md) records the RLS, service-role, CORS, session-cookie, and public-data findings. Apply migration `012_security_boundaries.sql` after 011 for inherited/default privilege hardening and creator Storage restrictions. Public sponsorship responses omit payment proofs and internal fields. Production session origins must use HTTPS; creator images remain public by direct URL.

Availability checks allow 30 requests per 60-second window, including invalid inputs. Counters are updated atomically in Supabase and shared across server instances. Excess requests return 429 with a `Retry-After` header in seconds. On Vercel, clients are identified by the platform's `x-vercel-forwarded-for` header ([Vercel request headers](https://vercel.com/docs/headers/request-headers)); only keyed hashes are stored. Outside Vercel, requests share one bucket because caller-supplied forwarding headers cannot be trusted. Expired keys are removed in bounded batches after one day of inactivity. If the limiter is unavailable or migration 005 is missing, checks fail closed with 503.

## Creator and fan flow

1. Choose Connect or claim an alias on the landing page. Phantom is never prompted automatically.
2. Click Connect to open Phantom and approve the sign-in message on the current page. Protected dashboard URLs display an inline wallet gate without redirecting to a sign-in page. The server verifies a single-use, five-minute challenge and issues a 24-hour HTTP-only, SameSite=Lax cookie (Secure on HTTPS). Only a hash of the random session token is stored. Logout revokes the stored session and disconnects Phantom.
3. Claim one available 1–30 character alias at its current on-chain SOL price. The server simulates and sponsor-signs the registry registration; the creator adds their signature. Confirmation verifies the durable intent, exact debit, and both ownership PDAs before indexing the profile. Retrying confirmation is idempotent.
4. Open `/dashboard/card`. Your purchased alias is read-only. Profile text, small raster images, theme, social links and page links load from Supabase. Save and publish updates the public card; Save without publishing persists a private card. Local backups are optional and scoped by wallet.
5. Share `/<alias>`; `/@<alias>` redirects there. Public cards require no wallet connection, include profile metadata and return HTTP 404 when missing or unpublished. Sponsorship offers retain their separate `/creators/<alias>` pages.
6. A fan opens the Tips modal and chooses USDC (the default) or SOL. USDC tips range from 0.01 to 1,000 USDC, with Kora sponsoring network fees and recipient token account creation. SOL tips retain the 0.00001–10 SOL range and wallet-paid fees. Tipping authenticates the fan without requiring an alias. The server verifies the devnet transfer, currency, exact amount, recipient and operation memo before storing a unique confirmed tip. The dashboard shows USDC and SOL totals separately. Apply migration 008 and follow [the Kora setup guide](docs/kora-usdc-tips.md) to enable USDC sponsorship; SOL continues to work before Kora is configured.

Payment signatures are retained in the browser as recovery references if verification is interrupted. Retry verification rather than sending another transfer. Existing known claims can be retried without rebuilding or re-paying.

`NEXT_PUBLIC_APP_URL` must match the app's exact origin because authenticated mutations enforce the request origin. Apply the new migration and perform a live devnet smoke test on a preview deployment before promoting production. The automated suite uses an isolated database and RPC fixture, and is not proof of a deployed live payment.

## Product scope

See [DEVROAD.MD](DEVROAD.MD) for the MVP milestones and deferred features. Subscriptions, bookings, product delivery, token gating, and mainnet support are not part of the current MVP.

### Planned feature: paid video calls and verified reviews

Creators will be able to offer video calls with a defined service, duration, price, and availability. Fans will reserve a slot and pay before the session, using the creator's completed-call history and verified reviews to decide whether to book.

- Record attendance and session duration to verify completed calls; completion alone does not prove a satisfactory experience.
- Allow one review per completed booking, written by the paying fan, covering punctuality, communication, and delivery of the promised service.
- Show completed-call counts, average ratings, review counts, and review comments on the public Creator Card.
- Define cancellation, no-show, connection-failure, refund, and dispute handling before release. Holding payment until completion is a proposed approach; the payment custody and settlement mechanism still needs to be selected.

This feature is planned for after the alias-to-tip MVP is validated and is not implemented yet. See the paid video-call milestone in [DEVROAD.MD](DEVROAD.MD).

## Creator image storage

Before testing creator image saves, configure the `creator-images` Supabase Storage bucket using the [setup procedure](docs/creator-image-storage.md). The server accepts PNG, JPEG and WebP up to 1 MB and 6000 pixels per side, checks wallet ownership, and saves Storage URLs to the profile. Existing inline images migrate when their owner next saves. Apply [migration 007](front/supabase/migrations/007_creator_image_cleanup.sql) before deploying the cleanup-enabled save flow. No additional environment variables are needed. [Image cleanup operations](docs/creator-image-cleanup.md) cover safe replacement deletion and retry.

Creator activity privacy: the card editor’s Perfil tab lets creators opt in to showing payer addresses in their authenticated tip activity. Addresses are hidden by default for existing and new creators, and the dashboard API omits them while hidden. Save the profile to apply the preference to past and future tips. Solana transactions and explorer links remain public. Apply `front/supabase/migrations/009_creator_activity_privacy.sql` before deploying this change.

## Documentation

Public creator links also support devnet SOL tips through `/api/actions/tip/:alias`, discoverable via `actions.json`. See [public tip Actions](docs/tip-actions.md) for URLs, request payloads, confirmation callbacks and client support.

Creator video-call offer setup and payment dependencies: [call offers](docs/call-offers.md).

AI-first dispute resolution and video-provider prototype: [feature specification](docs/ai-dispute-resolution-spec.md).

Daily operating funds and automatic billing: [treasury specification](docs/daily-operating-treasury-spec.md).

## License

GNU AGPLv3. Copyright (C) 2026 zuyux. See [LICENSE](LICENSE).
