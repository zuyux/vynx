# VYNX Development Roadmap

This roadmap defines the shortest path from the current repository to a working minimum viable prototype (MVP).

## MVP outcome

A creator can:

1. Open VYNX without an automatic wallet prompt.
2. Connect a Phantom wallet intentionally.
3. Claim one unique alias by paying the configured SOL fee.
4. Edit and save a basic creator card.
5. Share a public URL such as `vynx.me/@alice`.

A visitor can:

1. Open a creator card without connecting a wallet.
2. See the creator's saved profile.
3. Connect a wallet intentionally and send a SOL tip.
4. See a clear success or failure result.

The MVP is complete only when this entire journey works on production with real devnet transactions and persistent Supabase data.

## Scope decisions

### Included in MVP

- Phantom wallet connection
- Wallet ownership verification
- Unique alias claim
- Persistent creator profile
- Public creator page
- SOL tips
- Basic creator activity and earnings summary
- Mobile-friendly production deployment
- Essential security, validation, errors, and tests

### Deferred until after MVP

- Recurring subscriptions and Streamflow
- Digital product uploads and delivery
- Paid video-call bookings with upfront payment, verified completion, and verified fan reviews (Milestone 7)
- NFT or token-gated content
- USDC payments
- Alias transfer and release UI
- Advanced themes and page blocks
- Full analytics, referrals, affiliates, and recommendations
- Mainnet launch

## Current baseline

- [x] Next.js application and landing page
- [x] Phantom React SDK integration
- [x] Supabase client/server helpers
- [x] Initial `cards_users` migration
- [x] Alias payment transaction builder
- [x] Alias confirmation endpoint
- [x] Creator dashboard and editor UI mockups
- [x] Public profile UI mockup
- [x] Vercel production project and domains
- [x] Wallet-authenticated application session
- [x] Server-side transaction verification
- [x] Persistent profile editor
- [x] Dynamic public creator route
- [x] Working tip flow
- [x] Automated end-to-end test

The six implementation tasks above are implemented and verified locally with unit tests and an automated browser flow against disposable Postgres. The browser suite uses test wallets and a deterministic Solana RPC fixture. Production activation still requires applying migration 004, preview verification, and a live devnet payment smoke test; the release checklist below remains open for those steps.

## Priority legend

- **P0**: blocks the MVP user journey or protects money/data
- **P1**: required for a usable MVP release
- **P2**: valuable immediately after MVP

---

## Milestone 0 — Stabilize the foundation

Goal: make local, CI, and production behavior predictable before adding features.

- [x] **P0** Update `README.md` to match the actual stack and directory structure (Next.js 16, `front/`, current Phantom SDK).
- [x] **P0** Document devnet as the only supported MVP cluster.
- [x] **P0** Add explicit environment validation with helpful startup errors for:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SECRET_KEY`
  - `NEXT_PUBLIC_TREASURY_WALLET`
  - `NEXT_PUBLIC_SOLANA_RPC_URL`
  - `NEXT_PUBLIC_APP_URL`
  - `NEXT_PUBLIC_PHANTOM_APP_ID`
- [x] **P0** Ensure secrets never use the `NEXT_PUBLIC_` prefix.
- [x] **P0** Add scripts for `typecheck`, `test`, and `check` (`lint + typecheck + test + build`).
- [x] **P1** Add CI that runs `npm ci`, lint, typecheck, tests, and build for every pull request.
- [x] **P1** Decide whether alias ownership is authoritative in the Anchor program or Supabase for the prototype; use one source of truth, not both.
- [x] **P1** Remove or archive duplicate/unused contract sources after that decision.

Acceptance criteria:

- A new developer can run the app using only `README.md` and `.env.example`.
- Missing configuration fails clearly instead of producing a runtime crash.
- One command validates the frontend before deployment.

---

## Milestone 1 — Wallet authentication and authorization

Goal: prove wallet ownership and protect creator-only routes and mutations.

- [x] **P0** Add a nonce endpoint that issues short-lived, single-use sign-in challenges.
- [x] **P0** Ask the wallet to sign the challenge after the user explicitly chooses to connect.
- [x] **P0** Verify the signature on the server and create a secure HTTP-only session.
- [x] **P0** Bind each application session to one wallet address.
- [x] **P0** Protect `/dashboard`, `/dashboard/*`, and creator mutation APIs.
- [x] **P0** Reject profile edits when the session wallet does not own the profile.
- [x] **P0** Add logout that clears both the Phantom connection and application session.
- [x] **P1** Redirect authenticated creators without an alias to the claim flow.
- [x] **P1** Redirect authenticated creators with an alias to the dashboard.
- [x] **P1** Preserve the intended destination through the connect/callback flow.

Acceptance criteria:

- Opening the landing page never prompts for a wallet.
- Connect happens only after a user action.
- A forged wallet address in an API body cannot authorize a mutation.
- Unauthenticated users cannot access creator dashboard data.

---

## Milestone 2 — Secure alias claim

Goal: make alias purchase atomic, verifiable, and safe to retry.

- [x] **P0** Centralize alias normalization and validation on client and server:
  - lowercase only
  - 3–30 characters
  - letters, numbers, and underscore only
  - reserved-name denylist (`admin`, `api`, `dashboard`, `support`, and similar routes)
- [x] **P0** Add an alias availability endpoint with rate limiting.
- [x] **P0** Validate public keys and configuration before building a transaction.
- [x] **P0** In the confirmation endpoint, fetch the transaction from Solana RPC and verify:
  - signature exists and is finalized/confirmed
  - expected signer paid
  - expected treasury received the exact minimum amount
  - transaction is on the configured cluster
  - signature has not been used before
- [x] **P0** Never create an alias from an unverified `account` and `signature` request body.
- [x] **P0** Enforce one alias per wallet and one wallet per alias at the database level.
- [x] **P0** Make confirmation idempotent so retries return the existing successful claim.
- [x] **P0** Handle the race where two wallets attempt to claim the same alias.
- [x] **P1** Display actionable errors for rejected signature, insufficient payment, taken alias, RPC timeout, and user cancellation.
- [x] **P1** Store claim cluster, amount, treasury, signature, and verification timestamp.
- [x] **P1** Decide the on-chain registry direction: a new VYNX Anchor registry is deployed and smoke-tested on devnet; new claims use the registry by default; Supabase remains the profile index.
- [x] **P1** Implement registry instructions, canonical alias/owner PDAs, configurable SOL tiers, admin controls and sponsor authorization; verify signed transactions locally and on devnet. See [chain/README.md](chain/README.md).
- [x] **P1** Integrate the registry into the frontend/API: read on-chain pricing, sponsor and build registration instructions, support 1–30 character names, and verify both ownership PDAs.
- [x] **P0** Reconcile and migrate existing verified claims without charging again. Admin-and-owner signed, zero-charge migration and audit/prepare/reconcile tooling are implemented. The devnet program was upgraded and a live disposable-wallet migration verified zero creator charge and both ownership PDAs. The configured Supabase audit found one registry-backed claim and zero legacy claims, so no existing owners require signatures. Registry lookup and access controls passed on a Vercel preview. Database-only claims remain blocked until verified migration. See [migration procedure and verification evidence](docs/alias-claim-migration.md).

Acceptance criteria:

- A valid devnet payment creates exactly one alias record.
- A fake, failed, reused, or underpaid transaction creates no record.
- Refreshing or retrying after success does not double-charge or duplicate data.

---

## Milestone 3 — Persistent creator card

Goal: replace the dashboard mock with creator-owned data.

- [x] **P0** Add a migration for creator card fields:
  - display name
  - bio
  - avatar URL
  - banner URL
  - social links
  - theme/accent color
  - published status
- [x] **P0** Add ownership-safe server queries and update actions.
- [x] **P0** Load the signed-in creator's real profile in `/dashboard/card`.
- [x] **P0** Make “Save Changes” persist data and show saving, success, and error states.
- [x] **P0** Keep the claimed username read-only in the editor.
- [x] **P1** Add field length limits and URL validation.
- [x] **P1** Add image upload using Supabase Storage with MIME type and size limits. Creator-owned saves upload validated PNG/JPEG/WebP images (1 MB, 6000 pixels per side) and persist public Storage URLs. Unit/API, browser, and hosted preview/devnet checks passed. See [setup and verification](docs/creator-image-storage.md).
- [x] **P1** Remove replaced images to avoid orphaned storage objects. Atomic cleanup queue, reference guards, safe deletion/retry, interrupted-upload recovery and older-object discovery are implemented. Migration 007 is active; hosted preview verified replacement/removal deletion and preservation of the new image. Older-object discovery found no untracked candidates. See [cleanup procedure](docs/creator-image-cleanup.md).
- [x] **P1** Make the dashboard and editor usable on mobile; replace the fixed-width sidebar with responsive navigation.
- [x] **P1** Add unsaved-changes protection.

Acceptance criteria:

- A creator can reload the browser and still see all saved profile changes.
- A different wallet cannot read private editor data or modify the card.
- Invalid text, links, and uploads are rejected with clear messages.

---

## Milestone 4 — Public creator pages

Goal: deliver a real, shareable creator card backed by Supabase.

- [x] **P0** Replace the static `/profile` mock with a dynamic route such as `/@/[username]` or `/[username]`.
- [x] **P0** Fetch public profile data by normalized username.
- [x] **P0** Return a real 404 for missing or unpublished profiles.
- [x] **P0** Render saved avatar, banner, display name, bio, and social links.
- [x] **P1** Add per-profile metadata, canonical URL, Open Graph image, and social preview text.
- [x] **P1** Add copy-link and native share actions.
- [x] **P1** Prevent dashboard, API, asset, and reserved route collisions if using a root-level username route.
- [ ] **P1** Add loading and empty states without exposing internal errors.
- [ ] **P1** Verify accessibility: keyboard navigation, focus states, labels, color contrast, and reduced-motion behavior.

Acceptance criteria:

- `vynx.me/@username` loads without wallet connection.
- Public content matches the latest saved creator data.
- Shared links generate correct previews and missing aliases return 404.

---

## Milestone 5 — SOL tipping

Goal: complete the first creator monetization loop.

- [x] **P0** Add creator payout wallet and tip settings to the profile model.
- [x] **P0** Default payout to the verified owner wallet. Payout changes are intentionally unavailable in this MVP.
- [x] **P0** Add fixed and custom SOL tip amounts with sane minimum/maximum limits.
- [x] **P0** Build the transfer using the configured RPC cluster and creator payout address.
- [x] **P0** Add a server confirmation endpoint that verifies the on-chain transfer before recording it.
- [x] **P0** Make tip confirmation idempotent by transaction signature.
- [x] **P0** Record payer, creator, amount, signature, cluster, status, and timestamps.
- [x] **P1** Show pending, confirmed, rejected, and failed states to the fan.
- [x] **P1** Display real tip totals and recent tip activity in the creator dashboard.
- [ ] **P1** Add a Solana Action/Blink endpoint for public tip links.
- [ ] **P1** Add privacy controls for whether payer addresses appear in creator activity.

Acceptance criteria:

- A visitor can send a devnet SOL tip from a public profile.
- The creator receives the expected amount and sees the verified event in the dashboard.
- Fake or reused transaction signatures do not create tip records.

---

## Milestone 6 — Reliability, security, and release readiness

Goal: make the complete prototype safe enough for invited users.

- [x] **P0** Add unit tests for alias validation, transaction verification, authorization, and amount conversion.
- [x] **P0** Add integration tests for profile persistence and payment confirmation idempotency.
- [x] **P0** Add an end-to-end happy path:
  - visit landing page without a wallet popup
  - connect intentionally
  - claim alias
  - edit and publish card
  - visit public card
  - send tip
  - confirm dashboard activity
- [x] **P0** Add negative end-to-end coverage for taken aliases and failed/cancelled transactions.
- [ ] **P0** Rate-limit public mutation and payment endpoints.
- [ ] **P0** Add structured server logs without secrets or full sensitive payloads.
- [ ] **P0** Add error monitoring and alerts for failed payment verification and API 5xx responses.
- [ ] **P0** Review Supabase RLS, service-role usage, CORS, session cookies, and public data exposure.
- [ ] **P0** Confirm all production environment variables and URLs.
- [ ] **P1** Add user-facing Terms, Privacy, fee disclosure, network disclosure, and support contact.
- [ ] **P1** Add database backup/restore notes and rollback instructions.
- [ ] **P1** Test current Chrome, Safari, Firefox, and mobile viewport behavior.
- [ ] **P1** Run a small invited-user test and record blocking feedback.

Acceptance criteria:

- CI passes from a clean checkout.
- No P0 defects remain open.
- Production smoke tests pass on both `vynx.me` and `vynx-ten.vercel.app`.
- A new creator and fan can complete the MVP journey without developer intervention.

---

## Milestone 7 — Paid video calls and verified creator reputation (after MVP)

Goal: let creators sell their time and expertise while fans can assess prior completed sessions and verified reviews before paying.

Start after the full alias-to-tip MVP passes end-to-end tests. The first version supports one video-call offer per creator.

- [ ] **P2** Let creators define the service offered, duration, price, availability, and booking timezone.
- [ ] **P2** Let fans choose a slot and pay before the call; verify payment server-side and prevent duplicate payments or double-booked slots.
- [ ] **P2** Select the payment custody and settlement mechanism; evaluate holding funds until completion and define release, refund, and dispute rules before implementation.
- [ ] **P2** Provide a private video-call link to the booked participants and select a video provider with verifiable attendance and duration events.
- [ ] **P2** Track booking states, including awaiting payment, confirmed, completed, cancelled, no-show, and disputed; verify provider events server-side and process them idempotently.
- [ ] **P2** Define completion criteria using both participants' attendance and session duration. Keep verified completion separate from satisfaction or performance ratings.
- [ ] **P2** Allow only the paying fan to submit one review per completed booking, with an overall rating, comment, and feedback on punctuality, communication, and fulfillment of the offered service.
- [ ] **P2** Show verified completed-call counts, average ratings, review counts, and comments on the public Creator Card, with an empty state for creators without history.
- [ ] **P2** Define cancellation deadlines and handling for creator/fan no-shows, connection failures, refunds, disputes, and abusive reviews.
- [ ] **P2** Verify booking authorization, slot conflicts, payment retries, attendance event retries, review eligibility, rating aggregation, and refund/settlement behavior with automated tests.

Acceptance criteria:

- A fan can inspect a creator's completed-call history and verified reviews before booking and paying.
- A confirmed booking has exactly one verified payment and a private call link accessible only to authorized participants.
- Only sessions meeting documented attendance criteria count as completed; completion is not labeled as proof of a successful experience.
- Only the paying fan can review a completed booking, once; public ratings and counts derive from eligible persisted records.
- Cancellation, no-show, failed-call, and dispute flows follow disclosed rules without duplicate settlements or refunds.

---

## Suggested database additions

Create these through new, numbered migrations; do not edit an already-applied migration.

- `wallet_nonces`: nonce, wallet, expiry, used timestamp
- `wallet_sessions` or an equivalent secure session store
- extended `cards_users`: creator card and publication fields
- `social_links`: creator, platform, URL, display order
- `alias_claims`: wallet, alias, amount, treasury, cluster, signature, verification status
- `tips`: creator, payer, amount, currency, cluster, signature, status, timestamps

After MVP, for paid video calls:

- `call_offers`: creator, service description, duration, price, currency, availability, timezone
- `call_bookings`: offer, creator, fan, scheduled start/end, status, private provider session reference
- `call_payments`: booking, payer, amount, currency, cluster, signature, verification status, settlement/refund status
- `call_attendance`: booking, participant, provider event ID, joined/left timestamps, verified duration
- `call_reviews`: unique booking, paying fan, creator, overall rating, performance feedback, comment, timestamps

Every payment signature must have a unique database constraint.

## Suggested delivery order

Work in vertical slices and keep production deployable after each slice:

1. Foundation and wallet-authenticated session
2. Verified alias claim
3. Persistent creator editor
4. Dynamic public profile
5. Verified SOL tip
6. End-to-end hardening and invited-user release
7. Paid video-call bookings, verified completion, and verified reviews

Do not start subscriptions, products, or bookings until the full alias-to-tip path passes end-to-end tests.

## Definition of done for every task

A task is done when:

- implementation is complete and contains no mock data for that behavior;
- authorization and input validation are enforced server-side;
- loading, empty, success, and failure states are handled;
- relevant automated tests are added or updated;
- `npm run lint` and `npm run build` pass;
- environment and migration changes are documented;
- the change is verified on a preview deployment before production promotion.

## MVP release checklist

- [ ] Landing page does not request a wallet automatically.
- [ ] Intentional wallet connect and logout work.
- [ ] Wallet ownership is verified server-side.
- [ ] Alias availability and claim work on devnet.
- [ ] Alias payments are verified on-chain.
- [ ] Creator profile edits persist.
- [ ] Public creator URLs resolve correctly.
- [ ] SOL tips complete and are verified on-chain.
- [ ] Dashboard uses real profile and tip data.
- [ ] Mobile and accessibility checks pass.
- [ ] CI, production build, migrations, and smoke tests pass.
- [ ] Monitoring, support contact, disclosures, and rollback notes are ready.

When every item above is checked, VYNX has a working minimum viable prototype suitable for a controlled devnet beta.
