# Sponsored USDC tips on Solana devnet

USDC is the default currency in the Tips modal, with 1, 5 and 10 USDC presets. SOL remains available. This app uses Circle's devnet USDC mint, `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, with six decimal places. Devnet USDC is a test token with no financial value. [Circle mint addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses).

The app builds a USDC `transferChecked` instruction and an idempotent recipient associated token account instruction, with Kora as fee payer. Kora signs first without broadcasting; Phantom then adds the fan's signature and submits explicitly to devnet. Kora covers the network fee and any recipient account rent. The app checks Kora's signature and requires the returned transaction message to match the original exactly. Confirmation checks the mint, source and recipient accounts, wallet signer, amount, operation memo, successful transaction and actual USDC balance increase before recording a tip. SOL and USDC totals stay separate.

The Kora RPC and API key are server-only. The app exposes no general-purpose Kora signing proxy. Without `KORA_RPC_URL`, a USDC request returns an availability error before asking the wallet to send; SOL remains usable.

## 1. Apply the database migration

Apply `front/supabase/migrations/008_usdc_tips.sql` through your normal Supabase migration process, after migrations 001–007. This retains existing SOL tips and adds currency-aware storage and totals. Deploy the migration before the updated app.

## 2. Install Kora and create a sponsor

Install Rust/Cargo and the Solana CLI if needed. The provided configuration targets Kora **2.0.3**; newer releases may use different configuration fields. [Official operator guide](https://solana.com/docs/tools/kora/operators), [versioned configuration reference](https://github.com/solana-foundation/kora/blob/v2.0.3/kora.toml).

```bash
cargo install kora-cli --version 2.0.3 --locked
mkdir -p "$HOME/.config/vynx-kora"
chmod 700 "$HOME/.config/vynx-kora"
solana-keygen new --no-bip39-passphrase --silent --outfile "$HOME/.config/vynx-kora/sponsor.json"
chmod 600 "$HOME/.config/vynx-kora/sponsor.json"
solana airdrop 2 --url devnet --keypair "$HOME/.config/vynx-kora/sponsor.json"
solana balance --url devnet --keypair "$HOME/.config/vynx-kora/sponsor.json"
```

Use a dedicated devnet sponsor. Fund it with test SOL through the [Solana faucet](https://faucet.solana.com/) if the CLI airdrop is rate limited. Do not reuse a mainnet wallet or commit the keypair.

## 3. Configure sponsorship

From the repository root:

```bash
cp docs/kora/kora.toml "$HOME/.config/vynx-kora/kora.toml"
cp docs/kora/signers.toml "$HOME/.config/vynx-kora/signers.toml"
chmod 600 "$HOME/.config/vynx-kora/kora.toml"
```

Generate a secret with `openssl rand -hex 32`. Set `api_key` in the **private copy** under `[kora.auth]`, and use the same secret for the app's `KORA_API_KEY`. The supplied policy allows only the programs used by this flow, only devnet USDC, at most two signatures, and a maximum 0.005 SOL transaction cost. Keep `[validation.price] type = "free"`: paid/margin pricing does not implement full sponsorship.

Kora 2.0.3's usage limit needs Redis. For local development:

```bash
docker run --name vynx-kora-redis -d -p 127.0.0.1:6379:6379 redis:7-alpine
```

The template caps sponsorship at 20 requests per sender for this Redis lifetime and fails closed if Redis is unavailable. Rejections and requests that never reach the chain can consume quota. Set an appropriate limit and persist Redis for your deployment; newer Kora versions support different quota rules. Keep the Kora endpoint private or protected by its API key, and monitor sponsor SOL balance.

## 4. Start the node

Kora's memory signer accepts the JSON keypair as an environment value. Start it in its own terminal:

```bash
export KORA_PRIVATE_KEY="$(cat "$HOME/.config/vynx-kora/sponsor.json")"
kora --config "$HOME/.config/vynx-kora/kora.toml" \
  --rpc-url https://api.devnet.solana.com \
  rpc start --signers-config "$HOME/.config/vynx-kora/signers.toml"
```

Use the same devnet RPC cluster as the app. The default Kora HTTP port is 8080. For hosting, run this long-lived Rust service on a container/VM, protect it with HTTPS and authentication, and store the sponsor key only in that service's secret environment. The Next.js app needs only the endpoint and API key.

## 5. Connect the app

Add to `front/.env.local` (or the app hosting's secret environment):

```dotenv
KORA_RPC_URL=http://127.0.0.1:8080
KORA_API_KEY=<same secret as your private Kora configuration>
```

Restart the app. On a hosted app, replace localhost with the reachable HTTPS URL of your node. These variables must never use the `NEXT_PUBLIC_` prefix.

## 6. Test with devnet USDC

Get Solana devnet USDC from [Circle's faucet](https://faucet.circle.com/). Use a fan wallet different from the creator and sponsor, enable Phantom Testnet Mode and Solana Devnet, and open the creator's Tips modal. Choose USDC, send 1 USDC, and approve the transfer. Verify the creator receives 1 USDC and the dashboard records it separately from SOL. Repeat with a creator who has no USDC associated token account to verify sponsored account creation. Also test a fan holding USDC but zero SOL.

Troubleshooting:

- **Sponsorship unavailable:** check the endpoint, matching API key, node logs, sponsor SOL balance and Redis.
- **Validation rejection:** check USDC/memo/associated-token program allowlists, free pricing, account-creation policy and cost limit.
- **Invalid sponsored transaction:** use the versioned configuration; Kora must preserve the message and requested signer. Any feature that adds instructions or changes the blockhash is rejected.
- **Insufficient USDC:** fund the fan's devnet USDC account through Circle's faucet.
- **Sent payment still confirming:** retry verification with the existing signature. Do not make another transfer.

`npm run test:e2e` in `front` verifies the real app/API/database flow with deterministic Kora and Solana RPC boundaries. It does not exercise a live Kora node or transfer live devnet tokens.

## Local service and live checks

On this workspace, the node is managed by the user service `vynx-kora.service`. The private configuration, sponsor and test-wallet keys live under `~/.config/vynx-kora/`; Redis uses the `vynx-kora-redis` Docker container and a persistent volume. The app reads its endpoint and API key from the ignored `front/.env.local`.

```bash
systemctl --user status vynx-kora
systemctl --user restart vynx-kora
journalctl --user -u vynx-kora -n 30
```

From `front`, `npm run smoke:kora` sends a live sponsored memo transaction with a zero-SOL test fan. `npm run smoke:kora -- --usdc` sends 0.01 devnet USDC and verifies the transfer. If a published creator exists, it records a verified tip through the server helpers; otherwise it transfers to a dedicated test recipient and does not create or publish a creator profile. Each run submits a real devnet transaction and consumes sponsorship quota. The USDC mode requires the test fan to hold Circle devnet USDC.


## Vercel production configuration

The `fabohaxs-projects/vynx` Vercel project serves `https://vynx.me`. Its production environment has `KORA_RPC_URL=https://kora.ossr.network` and a server-only Secret `KORA_API_KEY`. The app URL is `https://vynx.me`. These hosted transfers still use Solana devnet and test USDC.

A dedicated Cloudflare tunnel named `vynx-kora` forwards `kora.ossr.network` to the local Kora HTTP server on port 8080. It is independent of the existing `ossr-relay` tunnel. Its private configuration is `~/.config/vynx-kora/tunnel.yml`; credentials remain outside the repository. Unauthenticated Kora requests return HTTP 401.

```bash
systemctl --user status vynx-kora vynx-kora-tunnel
journalctl --user -u vynx-kora-tunnel -n 30
```

The tunnel and Kora user services start automatically with the user session. This computer, its Internet connection, Kora, and the Redis container must remain available for hosted fee sponsorship. For operation independent of this computer, move Kora and Redis to an always-on cloud host and update the Vercel endpoint/key, then redeploy.
