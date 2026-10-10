# Verified legacy alias migration

The registry program is `AxQxAgndT6ziUr3FBNafhJzF4PpniGpMX4fVRXXmh5y8` on **devnet**. Migration preserves the existing canonical alias and wallet pair. Creators pay zero SOL; VYNX's admin funds registry deposits and network fees. Historical payment metadata and profile content remain unchanged.

## Eligibility and safeguards

The operator tool reads existing Supabase claims, requires devnet verification metadata, and re-fetches the original finalized transaction. It validates the owner signature, exact stored amount, stored treasury, and alias-bound memo. Today's price and treasury do not replace historical evidence. Missing/pruned transactions, incomplete metadata, noncanonical aliases, and conflicting ownership require manual review; they never trigger another purchase.

The on-chain instruction requires the current admin and creator signatures, paused registration, canonical unclaimed alias/owner PDAs, and an expiry no more than 150 slots ahead. It cannot overwrite ownership or give a wallet a second alias. The admin attests payment eligibility; the program does not inspect historical transactions. This is an admin power to create free registrations with owner consent during maintenance. Keep the admin key outside the serving application and unpause after migration.

Migrated records use zero paid lamports and price version zero, plus a deterministic 16-byte hash of the original signature, alias, and owner in the intent field. The original payment remains in Supabase; do not treat migration as new revenue.

## Operator procedure

1. Build/test the updated program and verify it on a preview/local registry flow. Upgrade the devnet program before using the new instruction. No deployment is performed by the migration tool.
2. Apply existing database migrations through 006. Configure server-only `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `NEXT_PUBLIC_SOLANA_RPC_URL` using your existing environment-loading mechanism. Run from `front/`:

   ```bash
   npx tsx scripts/migrate-alias-claims.ts audit
   ```

   Audit is read-only. Resolve every blocked result. A missing archived RPC transaction must not be bypassed by trusting a row alone.
3. Pause registrations using the admin. Set `VYNX_MIGRATION_ADMIN_KEYPAIR_PATH` to the local admin keypair path. Prepare one eligible claim:

   ```bash
   npx tsx scripts/migrate-alias-claims.ts prepare alice /tmp/alice-migration.json
   ```

   The output has mode 0600 and is never overwritten. It contains an admin-partially-signed transaction, not a secret key. The creator must inspect and sign this exact transaction with their existing wallet. Use an owner-controlled wallet signing client to submit on devnet; never collect creator secret keys. Expired transactions require re-audit and a fresh output file. The creator must not be the fee payer.
4. After confirmation, reconcile:

   ```bash
   npx tsx scripts/migrate-alias-claims.ts reconcile alice
   ```

   Reconciliation validates both PDAs, zero migration charge/version and the legacy proof hash, then conditionally updates only registry index columns. Retrying reconciled claims verifies ownership and succeeds without writing or charging again. Audit also detects confirmed migrations awaiting reconciliation if a process stopped after submission.
5. Repeat audit, verify editor/public access on preview, unpause registrations, and perform live devnet smoke tests before production promotion.

Existing database-only aliases continue reserving names and wallets while blocked from registry-authorized access. Re-audit before every migration window; any future legacy claims need their actual owners to consent.

## Verification — October 10, 2026 (America/Lima)

- Upgraded the existing devnet program and verified deployed bytes against SHA-256 `a9b28b602c80038a5a5c231c61dda09de040eaec0444d024b8f3e3dc6c53f493`. See [deployment evidence](../chain/devnet-deployment.json).
- A disposable owner signed a live migration; both ownership PDAs matched, creator balance stayed at zero, and treasury received zero. Registrations returned to their original unpaused state. This smoke test is not a historical purchase and creates no Supabase claim. See [migration evidence](../chain/devnet-migration-smoke.json).
- Read-only audit of the configured Supabase database returned exactly one claim (`fabohax`), already backed by matching registry ownership. There were zero eligible or blocked legacy claims; no actual owner signatures or database updates were needed.
- [Vercel preview](https://vynx-2gftarboq-fabohaxs-projects.vercel.app) built successfully. Registry-backed profile lookup and on-chain claim pricing returned HTTP 200; unauthenticated editor API access returned 401. The existing unpublished creator page returned 404 as expected.
- The preview's missing sponsor configuration was supplied as a Preview-only Secret using the existing configured devnet sponsor. Production frontend was not promoted; its sponsor configuration is a separate release-readiness task.
- Contract suite: 13 passing tests. Prior frontend validation: lint, typecheck, 46 unit tests, production build, and 6 registry browser tests passed. Lint was rerun after this deployment work.

The roadmap migration item is complete for the audited database. This does not mark the broader production release checklist complete.
