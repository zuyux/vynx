# Generated demo profiles

Four fictional creator profiles are defined in `data/demo-profiles.json`:
`demo_lunastudio`, `demo_mateobeats`, `demo_sofiaframes`, and `demo_kaiworks`.
Portrait assets live in `public/demo/creators/`. The built-in image generation tool
created one distinct editorial portrait per profile. Exact prompts are recorded
in `data/demo-profile-prompts.json`.

Preview the inserts with:

```sh
node --env-file=.env.local scripts/seed-demo-profiles.mjs
```

Seed the connected Supabase database with:

```sh
node --env-file=.env.local scripts/seed-demo-profiles.mjs --apply
```

The seed inserts all missing rows in one database request. Repeating it skips
existing matching demo rows; it never overwrites a profile. A conflicting alias
aborts the seed. Stable IDs and generated devnet wallet addresses identify the fixtures.
Private keys are stored only in the ignored `front/.env.local` as base58
64-byte Solana secret keys, under `VYNX_DEMO_<NAME>_PRIVATE_KEY` alongside
`VYNX_DEMO_<NAME>_ADDRESS`. Funding receipts contain public data only in
`data/demo-profile-funding.json`. The initial seed does not create alias claims.
All records are unpublished with tips disabled. Social URLs are fictional mock
handles, not verified accounts.

To reuse wallets and top up to the live alias price plus 0.02 devnet SOL:

```sh
npx tsx --env-file=.env.local scripts/fund-demo-profiles.ts
```

This script verifies the devnet genesis, preserves existing generated keys,
updates only matching demo records, and funds from the configured development
wallet. It saves the transaction signature before submission and refuses another
transfer while a previous funding result is unresolved. It does not claim aliases.

To claim the four aliases with their existing demo wallets and retain the card
placeholder information, preview and then apply:

```sh
npx tsx --env-file=.env.local scripts/claim-demo-profiles.ts
npx tsx --env-file=.env.local scripts/claim-demo-profiles.ts --apply
```

This command checks devnet and wallet identity, signs real registry registrations,
and saves public signed transaction receipts in `data/demo-profile-claims.json`
before submission. It verifies finalized transactions and ownership before updating
the matching demo cards. Repeating the command reconciles saved receipts without
paying again; failed or expired receipts require inspection before retrying.

The generated WebP portraits are embedded into database designs as data URLs,
so profile images work independently of asset deployment or object storage.
View the persisted profiles at `/demo/creators`, linked from Studio. This gallery
uses the existing creator card in preview mode. It does not expose unrelated
unpublished profiles or bypass ownership checks on normal alias routes.
