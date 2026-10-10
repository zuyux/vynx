# VYNX alias registry (devnet implementation)

The program implements permanent on-chain VYNX aliases, one alias per wallet, one owner per alias, configurable SOL prices, reserved names, sponsored registration authorization, pause controls, and two-step admin rotation. The frontend uses the registry for new claims and Supabase as its profile index. Existing claims require a verified, owner-approved migration; deploying the program alone does not migrate users.

Deployed and initialized on Solana devnet on October 9, 2026 (America/Lima). Program address:

`AxQxAgndT6ziUr3FBNafhJzF4PpniGpMX4fVRXXmh5y8`

Live verification: registered `vynx_2fwwxbswdzac`, verified both ownership PDAs and a creator debit of exactly 10,000,000 lamports. The treasury received 7,744,480 lamports, registry deposits used 2,255,520 lamports, and the sponsor paid 10,200 lamports in network fees. The deployed bytes match the local SBF binary.

Public evidence is stored in [`devnet-deployment.json`](devnet-deployment.json) and [`devnet-smoke.json`](devnet-smoke.json). [View the program](https://explorer.solana.com/address/AxQxAgndT6ziUr3FBNafhJzF4PpniGpMX4fVRXXmh5y8?cluster=devnet) or [the registration transaction](https://explorer.solana.com/tx/27n4ofVrCyLTcY5MtTAh6Ffftz23z3VHBHY3X4hrrx5SQhC8kJJPJ5tLHE1MiutWyQvoc9PXwSzZSKsftEp25srT?cluster=devnet).

## Build and test

Toolchain: Anchor 1.2.1, Agave/Solana 4.1.2, SBF platform tools v1.57, Rust 1.89+ for host builds, Node 22+.

```bash
cd chain
npm ci
cargo test --locked
cargo build-sbf --tools-version v1.57 --arch v3
npm test
```

Run `anchor build` for the generated IDL, then copy `target/idl/vynx_alias.json` to `idl/vynx_alias.json` when program interfaces change. Runtime tests use LiteSVM with the compiled SBF binary and exercise signed transactions, account rent, transfer accounting, duplicate claims, authorization, stale prices, expiry, pause controls, rotation and rollback. They do not use live devnet.

The CLI tools installed during initial development live at:

- `/home/hax/.cargo/bin` (rustup and Rust toolchains)
- `/home/hax/.local/share/solana/install/active_release/bin`
- `/home/hax/.local/share/vynx-toolchain/bin`

Add those directories to PATH for this workspace. On another machine, install the pinned toolchain from the official Anchor/Agave installation instructions.

## Devnet deployment

Use test SOL only. Every Node deployment/admin command checks the devnet genesis hash before writing. The Anchor provider defaults to devnet, but CLI overrides can change it; prefer the guarded scripts below.

Ignored local files hold the development deployer, sponsor, treasury, creator and program keypairs. Back up them securely; never commit them. The program keypair in `target/deploy/vynx_alias-keypair.json` must match `program-id.txt`, `declare_id!` and `Anchor.toml`. A new clone needs the existing development program keypair to deploy at that address, or a new program ID consistently applied to these files. Do not replace it accidentally.

Initial development deployer: `9ytC5Uqmo9pypjZ4doudroGNdVJgSPsM2RxMwfjdSy7g`.

```bash
# After funding the development deployer with devnet SOL:
npm run deploy:devnet
npm run initialize:devnet
npm run fund:devnet
npm run smoke:devnet
npm run prices:devnet
```

`deploy:devnet` validates the cluster, matching program keypair and deployment funding, then records the public deployment details and binary hash only after the executable loader-owned program and its actual on-chain bytes are verified. `initialize:devnet` checks the deployment upgrade authority on-chain, preventing first-caller admin takeover. `fund:devnet` sends test SOL to the local sponsor, smoke creator and treasury. `smoke:devnet` verifies both ownership PDAs and that the creator's balance decreased by exactly the configured total.

Optional environment overrides: `VYNX_DEVNET_RPC_URL`, `VYNX_SOLANA_CLI`, `VYNX_DEPLOYER_KEYPAIR`, `VYNX_SPONSOR_KEYPAIR`, `VYNX_TREASURY_KEYPAIR`, `VYNX_CREATOR_KEYPAIR`. Keypair variables contain local file paths, not secret values. The smoke commands expect their configured sponsor/admin wallets to match on-chain configuration.

## Price administration

Initial tiers in SOL: 0.92 / 0.53 / 0.30 / 0.14 / 0.01 for lengths 1 / 2 / 3 / 4 / 5–30. Amounts are integer lamports; there is no USD oracle.

```bash
# Read current tiers:
npm run prices:devnet
# Change tiers using the configured admin (example: restore initial prices):
npm run prices:devnet -- 920000000 530000000 300000000 140000000 10000000
```

The admin can change tiers, pause new registrations, replace the sponsor, and nominate an admin. The nominee signs acceptance. There is no transfer, closure, treasury-change or alias-confiscation instruction. The program remains upgradeable by its deployment authority; this power is separate from registration administration.

## Registration and sponsorship

PDAs: `["config"]`, `["alias", canonical_alias]`, `["owner", owner_public_key]`. The program accepts only canonical lowercase ASCII names; the client trims and normalizes input first. Both the alias and owner-index accounts are permanent and must be unclaimed.

The sponsor co-signs the full transaction: this binds the program, accounts, owner, canonical name, quoted lamport amount, version, expiry and 16-byte intent ID. Quotes last at most 150 slots and the program rejects price/version changes. A completed alias stores the intent; the wallet/alias uniqueness prevents successful replay. Failed intents remain retryable. The sponsor must be the transaction fee payer to meet the all-in pricing policy. Fee-payer selection is enforced by VYNX's transaction construction and signer service, not by the on-chain program.

Registration computes current required deposits and sends the remainder of the total to the configured treasury. Prefunded PDA donations do not discount the creator's total: only deposits actually paid by the creator are subtracted from the treasury payment. Failed transactions roll back account creation and transfers, although the sponsor can still pay network fees.

The included client constructs known instructions directly; the generated Anchor IDL is the source of truth for other clients. Production admission rate limits, durable sponsorship tracking, frontend integration, existing-claim migration and independent security review remain required before cutover/mainnet. The local admin/sponsor keys are development keys, not production credentials.

## Legacy migration

The new `migrate_verified_claim` instruction requires paused registration, current admin and owner signatures, and a short expiry. The admin pays deposits; the creator pays zero. The program upgrade and a zero-charge disposable-wallet migration were verified on devnet on October 10, 2026 (America/Lima); public evidence is in `devnet-migration-smoke.json`. Run `npm run smoke:migration:devnet` to repeat with a fresh disposable owner; this briefly pauses registration and restores the original pause state. Follow the [audit and migration procedure](../docs/alias-claim-migration.md).
