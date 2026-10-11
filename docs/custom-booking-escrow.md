# Custom booking escrow — development implementation

The user selected development of a dedicated Solana escrow program on October 11, 2026. This replaces the unresolved third-party-provider dependency for development; it does not waive independent audit or authorize production custody. The implementation uses actual SPL USDC transfers, not simulated balances, when enabled on devnet. Devnet tokens have no monetary value.

## Implemented

`chain/programs/vynx-booking` is a separate Anchor program. Each booking UUID derives a permanent receipt PDA and a token vault controlled by that receipt. Funding atomically initializes both accounts and transfers the exact quoted principal. A server quote authority and the paying fan must sign. The receipt snapshots the payer, creator, mint, resolver, amount, UTC schedule and accepted-terms hash. Repeated funding cannot initialize the receipt again, including after refunds or settlement. The alias registry is unaffected.

Migration 014 adds private bookings with an exclusion constraint over creator and UTC intervals, unique payment signatures, immutable price/terms snapshots and atomic reservation/payment RPCs. Weekly availability is interpreted in the creator's IANA timezone. Slots have 15-minute local boundaries and a 15-minute lead time; discovery covers 14 days, with server admission capped at 60 days. DST gaps are skipped, repeated times have separate UTC instants, and sessions crossing a clock transition are rejected.

`/api/bookings` binds all mutations to the wallet session, checks origin and rate limits, verifies creator registry ownership and stores exactly one server-signed transaction per reservation. Concurrent checkout requests return the stored transaction. Confirmation requires a successful finalized transaction whose message matches that transaction and a program-owned finalized escrow receipt matching the booking. Client signatures alone cannot confirm a booking. Unique signatures and the permanent PDA prevent payment reuse.

Reservations last 10 minutes, although the transaction's blockhash can expire earlier. Expired slots remain locked until finalized block height exceeds the prepared transaction's validity and its finalized receipt is absent. Funding that landed before quote expiry but finalized later is reconciled into the existing booking. RPC failures preserve the lock. Discovery and new reservation requests run bounded reconciliation (100 expired rows at a time); no background worker is installed yet. A stored transaction is never renewed automatically.

The booking panel appears on published Creator Cards and sponsorship pages. It discloses test tokens, unaudited escrow, network/account costs and development settlement terms before funding. It persists the reservation before opening the wallet, persists an uncertain-send marker, and offers signature recovery after reload. Retrying checkout uses the same operation. Browser storage failure prevents sending. Confirmed/chain-reconciled expired references can be cleared to choose another booking.

## Development policy v1

These are **devnet development terms**, not production Terms. They are included in the accepted booking snapshot and enforced by the program where stated:

- Full principal stays in the vault. The fan pays account rent and network fees separately; refunds return principal only. Receipt/vault rent is not reclaimed in this version. Donations to the vault are not included in the settlement allocation.
- The creator can refund the full principal. The fan can cancel with a full refund at least 24 hours before the start, while undisputed.
- Either participant can dispute until 24 hours after the scheduled end. A dispute freezes participant cancellation refunds and normal payout. The resolver cannot settle until that window closes.
- A named, immutable-per-booking resolver can allocate the principal between payer and creator exactly once after the dispute window and before recovery. This is a **trusted settlement authority**, not trustless adjudication. The program does not verify call completion, recordings or AI decisions. The future resolver service must verify that evidence and appeals before signing; there is no automatic payout worker in this change.
- At 30 days after the scheduled end, either participant can recover all principal to the payer, even during a dispute. Resolver allocation is then forbidden. This bounds resolver-outage recovery but requires explicit review of the commercial implications before launch.
- The deployment upgrade authority can replace program logic. Quote-authority compromise can authorize fraudulent terms/slots; resolver compromise can misallocate principal. Isolate these keys, use production governance/multisigs, and commission an audit covering these authorities and the database-to-chain protocol.

## Local setup and devnet provisioning

1. Install dependencies in `chain` and `front`. Use the toolchain documented in `chain/README.md`.
2. Build/test locally:

   ```bash
   cd chain
   cargo test --locked -p vynx-booking
   cargo build-sbf --manifest-path programs/vynx-booking/Cargo.toml --tools-version v1.57 --arch v3
   anchor idl build -p vynx_booking -o idl/vynx_booking.json
   npm test
   ```

3. Deploy the separate booking binary **to devnet only**, using the public ID in `chain/booking-program-id.txt` and its matching ignored `chain/target/deploy/vynx_booking-keypair.json`. A development keypair was generated locally; it is not committed. Preserve it, or generate a new program keypair and consistently update `declare_id!`, Anchor.toml and the public ID file before rebuilding. Do not reuse or upgrade the alias program. Use `node scripts/deploy-booking-devnet.cjs` from `chain` to enforce devnet genesis, matching keys, deployment funding and bytecode verification. Deployment and initialization were completed on devnet on October 11, 2026 (America/Lima); see the evidence below.
4. Initialize with the deployment-authority signer. Explicitly set `VYNX_BOOKING_QUOTE_AUTHORITY` and `VYNX_BOOKING_RESOLVER` to separate development public keys, then run `node scripts/booking-devnet.cjs initialize`. `VYNX_BOOKING_AUTHORITY_KEYPAIR_PATH` selects the signer file; default is the existing ignored devnet deployer. The script verifies the devnet genesis hash before writes.
5. Apply migration 014 to the development database. Set server-only `VYNX_BOOKING_PROGRAM_ID`, `VYNX_BOOKING_QUOTE_SECRET` (JSON array of 64 keypair bytes), and `VYNX_BOOKING_ESCROW_ENABLED=true`. Use `next dev`; `NODE_ENV=production` blocks checkout even when the flag is set. Never place the secret in a public environment variable or source control.
6. Publish a creator card, configure/enable an offer, and fund a separate fan's devnet USDC associated token account and devnet SOL balance. Visit the creator card, accept the development policy, choose a slot and approve funding. Confirm the receipt and slot lock before attempting a second overlapping booking.

Recovery and settlement are available through a participant/resolver CLI, with a devnet signer selected by `VYNX_BOOKING_AUTHORITY_KEYPAIR_PATH`:

```bash
node scripts/booking-devnet.cjs dispute BOOKING_UUID
node scripts/booking-devnet.cjs refund BOOKING_UUID
# Trusted resolver only; amount is integer USDC base units, not decimal USDC.
node scripts/booking-devnet.cjs resolve BOOKING_UUID CREATOR_UNITS
```

These commands finalize on chain and read back program-owned state. Preserve submitted transaction signatures after any timeout; inspect finalized state before retrying. Refund/dispute UI and database settlement-state synchronization are not implemented in this checkout change. A refunded booking currently remains a confirmed/occupied slot in the database; the later booking-state milestone must reconcile cancellations and settlement before launch.

## Verification and launch boundaries

Local SBF runtime tests cover funding, exact debit/vault balances, duplicate IDs, quote substitution, expiry, amount/mint/schedule validation, disputes, resolver authorization, partial settlement, cancellation timing, wrong destinations, terminal-state replays and outage recovery. Frontend tests cover UTC/DST slots, interval conflicts, receipt binding and the production gate. Isolated PostgreSQL tests apply every migration, check browser grants/RLS, snapshot terms, checkout/confirmation retries, unique signatures, safe expiry, and actual concurrent reservation conflicts/retries.

This is an unaudited local/devnet implementation. The live devnet deployment and initialization are verified. No live database migration is claimed. A subsequent live devnet funding/refund test passed; see the evidence below. Independent audit, devnet end-to-end funding evidence, final settlement/appeal policy, participant recovery UX, Daily completion verification, durable reconciliation and production governance remain launch requirements. The production roadmap item stays open.

## Verified devnet deployment — October 11, 2026

Program: `B6FdE4aAcavkyh1u7UXadQXTQrGYmGWpPqKbfQ6sX7mY`. [View program](https://explorer.solana.com/address/B6FdE4aAcavkyh1u7UXadQXTQrGYmGWpPqKbfQ6sX7mY?cluster=devnet). Its loader-owned on-chain bytecode matches the tested local SBF binary. The separate development quote and resolver keys are stored in ignored owner-readable wallet files; only their public addresses are recorded. Config binds these authorities and the six-decimal devnet USDC mint.

Evidence: [deployment](../chain/booking-devnet-deployment.json), [initialization](../chain/booking-devnet-initialization.json), [devnet smoke checks](../chain/booking-devnet-smoke.json), [test-SOL funding](../chain/booking-devnet-funding.json). The deployer received 0.085 devnet SOL from the existing sponsor/treasury test wallets after the faucet rejected an airdrop. No mainnet transaction occurred.

The devnet smoke script verified configuration and bytecode and simulated unauthorized quote funding and insufficient-USDC funding. Both failed as expected, with unchanged token balance and no receipt/vault created. The deployer's USDC associated token account is `7kEXcfkL8MmgUexmyzdvEwEFodmD1LctaAia67Quwnmg`, currently empty. Deposit devnet USDC before performing a successful live funding/refund test; no simulated failure is presented as successful escrow funding. Run `node scripts/booking-smoke-devnet.cjs` only with an empty devnet test-USDC source.

Retesting passed all three Rust unit tests, 19 SBF runtime tests, 121 frontend/API tests, lint/typecheck, and isolated PostgreSQL migration/security/concurrency checks. The alias registry's existing deployment also matches its rebuilt binary, and its live existing-registration smoke check passed; no redundant alias upgrade was submitted. Production checkout remains blocked pending independent audit and the other launch requirements.

## Live funding and full refund — October 11, 2026

The user supplied a devnet wallet through local environment configuration and funded it with 2 devnet SOL. Its recovery phrase was derived only in memory and matched `5iCqk1v4KYrNtwdarsZo977Qd7EqweJfZ2CRNPfZJykH`; no secret key or phrase is stored in the public evidence. The test funded 10,000 base units (0.01 devnet USDC), verified the finalized receipt and exact payer/vault balances, then executed a full timely fan-cancellation refund. The wallet retained its original 20 USDC; the vault ended empty and the permanent receipt reached settled state with zero creator allocation.

Actual finalized transactions: [funding](https://explorer.solana.com/tx/Au6VSvJqVYNzznSKDRVJY96JComvuyC7oAHbjZ6PmSNMCdLa9zXM1SSrcaiBDcRoW26Jtmsi6SPSxC4am3wWj3A?cluster=devnet), [refund](https://explorer.solana.com/tx/4RjcsuAaGUp5LHYctsg117vHJD8cRPiScwupeWyAukRDjetGeT32A5AZ4aMyyovQipjC9tj7bwtavrMe2uA3gav6?cluster=devnet). Simulations rejected duplicate funding, premature resolver settlement, refund replay and funding replay after settlement. An authorized dispute simulation succeeded without committing a dispute or locking the user's funds.

The wallet spent 4,790,200 lamports (0.0047902 devnet SOL), including account deposits and network fees, and ended with 1.9952098 devnet SOL. Public evidence is in [booking-devnet-funding-smoke.json](../chain/booking-devnet-funding-smoke.json). Run `npm run test:booking:devnet` from `chain` to reverify the existing settled receipt without submitting another payment. The script preserves its operation/signatures across retries and attempts a refund if a post-funding check fails.

This test exercises the live escrow program directly; it does not claim a browser-to-live-database booking journey, real attendance-based settlement, or an independent audit. Production remains disabled.
