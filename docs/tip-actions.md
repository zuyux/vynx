# Public SOL tip Actions

Published creator links (`https://<host>/alice` and `/creators/alice`) map through
`/actions.json` to `/api/actions/tip/alice`. An explicit Action URL is
`solana-action:https://<host>/api/actions/tip/alice`.

This endpoint follows the [Solana Actions specification](https://solana.com/docs/tools/actions).
It supports **devnet SOL** tips. Sponsored USDC remains available on the creator
page through the signed-in flow. The payer covers SOL network fees.

- `GET /api/actions/tip/:alias`: public metadata, devnet headers, an absolute PNG
  icon, 0.01/0.1/1 SOL buttons, and a custom amount input (0.00001–10 SOL).
  Paused creators return disabled metadata; unpublished/missing creators return 404.
- `POST /api/actions/tip/:alias?amount=0.01`: JSON `{ "account": "<wallet>" }`.
  Returns an unsigned base64 transaction and a `links.next` confirmation callback.
  Amount defaults to 0.01 SOL; explicit unsupported currencies are rejected.
  The server resolves the recipient and creator memo; client-supplied recipients
  do not change the transfer. The wallet must sign and broadcast the transaction.
- `POST /api/actions/tip/:alias/confirm?amount=0.01`: JSON
  `{ "account": "<wallet>", "signature": "<transaction-signature>" }`.
  Verifies the on-chain signer, recipient, exact amount, successful receipt and
  creator memo before recording the tip. Returns a completed Action. Retry this
  callback for pending confirmation or a lost response, without paying again.
  Signature uniqueness makes retries idempotent. The callback remains available
  if a creator later pauses tips or unpublishes their page.

Action requests and confirmation callbacks work without session cookies and
accept cross-origin clients. All responses, including errors and OPTIONS, carry
CORS and no-store headers. Merely building a transaction never records a tip.
Clients must follow the confirmation callback for the tip to appear in VYNX
activity; no background indexer is introduced. Payer-address visibility follows
the creator's saved activity privacy preference.

Run `npm test` in `front` for protocol, transaction-content and confirmation tests.
For deployment validation, use an Action-aware client or the Blinks Inspector
linked from the Solana specification. Automatic unfurling depends on the client's
registry and network support; this endpoint does not register the deployment with
an external registry.
