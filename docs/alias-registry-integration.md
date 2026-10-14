# Devnet registry integration

New claims use the registry by default. Deploying the frontend is a separate
step from the existing program deployment.

## Configure the application

1. Apply `front/supabase/migrations/006_alias_registry.sql` after migrations 001–005
   using the Supabase SQL editor or a privileged database connection. A Supabase
   service API key cannot apply SQL migrations.
2. Set `VYNX_ALIAS_REGISTRY_ENABLED=true` on every serving instance.
3. Configure exactly one server-only sponsor key source:
   `VYNX_ALIAS_SPONSOR_KEYPAIR_PATH` for a local keypair file, or
   `VYNX_ALIAS_SPONSOR_SECRET_KEY` containing the JSON array of 64 bytes as a secret
   hosting environment variable. Never put either under `NEXT_PUBLIC_` or commit
   a keypair. The public key must match the config PDA's sponsor; the current
   devnet sponsor is `7kbuAAJkBnxwJXpgxvBsLWhpc4SZ7rWsRh7xGDpLPLYP`.
4. Fund that sponsor with devnet SOL. It pays network fees, not creator account
   rent. The default rolling budget is 10,000,000 lamports/day; adjust the positive
   integer `VYNX_ALIAS_SPONSOR_DAILY_BUDGET_LAMPORTS` to change the cap.
5. Use a devnet RPC and the correct application origin. The registry treasury is
   read from chain; `NEXT_PUBLIC_TREASURY_WALLET` only serves legacy compatibility.

The local ignored environment uses the existing ignored devnet sponsor file.
Hosting needs its own secret configuration. No key material is returned by APIs.

## API and transaction flow

- `GET /api/actions/claim-alias?alias=a` reads current on-chain pricing and returns
  `priceLamports`, `priceSol`, `priceVersion` and `sponsored`. Quotes are advisory
  and do not reserve names. Public quote checks are limited to 30/minute in a
  separate bucket using the shared database limiter.
- `POST` to that route requires a wallet session, matching `account`, same origin,
  and the displayed `priceLamports`/`priceVersion` strings. A price change returns
  `PRICE_CHANGED` without requesting a wallet signature. Preparation validates
  the registry/config, rejects existing chain or database reservations, checks
  balances and fees, simulates the exact message, and partially signs with the
  sponsor as fee payer. No client-provided transaction is signed.
- The transaction contains bounded compute-budget instructions and the program's
  `register` instruction. It binds both PDAs, treasury, two signers, price/version,
  a 16-byte intent and an expiry 100 slots ahead. The browser adds the creator
  signature while preserving the sponsor signature. Wallet submission explicitly
  requests `solana:devnet` through Wallet Standard; the SDK's extension
  `switchNetwork` is a no-op and must not select the transaction cluster. Wallets
  without a matching devnet-capable account fail before submission. Owner debit is the total
  quoted price; VYNX pays the network fee.
- `POST /api/actions/claim-alias/confirm?alias=a` requires the same session/origin
  and the registration signature. It verifies the confirmed successful message
  against the stored message, exact owner debit, price/version/intent/slot,
  sponsor fee bound and both ownership PDA account layouts, program ownership,
  discriminator, canonical alias, owner, index pointer and bumps. It then indexes
  the profile. Idempotent retries repeat chain verification before trusting a
  database receipt. Arbitrary signatures and old transfer payments are rejected.
- `GET /api/actions/claim-alias/pending` privately recovers a broadcast intent for
  the authenticated wallet if local storage was lost. Never pay again merely
  because profile indexing or RPC history retrieval failed.

The durable ledger permits one unresolved preparation per wallet, returns the
same transaction for concurrent/repeated requests, and atomically reserves
estimated network fees across all instances. Five preparations/wallet/hour and
an aggregate rolling 24-hour budget limit sponsorship. Failed/expired intents
still consume the daily reservation budget. Reconcile signature status and wait
for blockhash expiry before releasing a preparation. Missing historical RPC data
with existing registry PDAs does not authorize another payment.

Existing database-only names remain reserved. Their profile access returns
`REGISTRY_MIGRATION_REQUIRED`; migrate them separately without charging again.
New claims never fall back to treasury transfers when RPC, sponsorship or schema
configuration is unavailable.

## Verify

`npm --prefix front test` includes codec/PDA tests and legacy regression fixtures.
For the registry browser suite, first build the SBF binary and install both
packages, then run `npm --prefix front run test:e2e:registry`. It applies every SQL
migration to disposable Postgres, uses the real compiled program in LiteSVM with
real wallet signatures, and exercises browser, API, database and program
boundaries. `test:e2e` separately keeps the previous compatibility suite.
Frontend CI runs both suites. Neither browser suite broadcasts to live devnet.

## Temporary full sponsorship

New registry claims are currently free to the user. The server signs with its configured local sponsor key and atomically funds the owner for the quoted registration price before registering; the owner still signs the exact transaction with their wallet or Privy. Failure rolls back the funding. No program upgrade is needed. Confirmation checks a zero net owner debit and preserves verification of older paid intents.

Apply migration `023_alias_claim_sponsorship.sql` to reserve registration prices plus network fees under the rolling 24-hour budget. `VYNX_ALIAS_SPONSOR_DAILY_BUDGET_LAMPORTS` defaults to 1,000,000,000 lamports (1 devnet SOL). Reservations remain counted after failure/expiry. Keep the sponsor funded for the quoted tier plus fees; insufficient sponsor balance rejects preparation before wallet approval.
