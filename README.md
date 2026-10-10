# VYNX

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

The runner removes its containers and network afterward. Browser failure traces are written to `front/test-results/` and the report to `front/playwright-report/`. It builds with test environment values; run `npm run build` again before starting the app with your normal environment.

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

## License

GNU AGPLv3. See `LICENSE` when present in the distribution.

### Creator image storage

Before testing creator image saves, configure the `creator-images` Supabase Storage bucket using the [setup procedure](docs/creator-image-storage.md). The server accepts PNG, JPEG and WebP up to 1 MB and 6000 pixels per side, checks wallet ownership, and saves Storage URLs to the profile. Existing inline images migrate when their owner next saves. Apply [migration 007](front/supabase/migrations/007_creator_image_cleanup.sql) before deploying the cleanup-enabled save flow. No additional environment variables are needed. [Image cleanup operations](docs/creator-image-cleanup.md) cover safe replacement deletion and retry.
