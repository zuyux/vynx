# Booking escrow evaluation

Evaluated 2026-10-11. The user selected audited escrow and requested provider evaluation before implementation. Custody direction is decided; no provider or deployed program has been approved. Booking checkout remains disabled.

## Outcome

No candidate below demonstrably meets the complete Solana service-booking requirement on the evidence reviewed. Do not substitute time-based token release, OTC swaps, a platform wallet, or direct tips for conditional service escrow. A custom adapter or program would create additional audit scope; an underlying protocol's audit does not cover that new logic.

| Candidate | Primary evidence | Fit for this application | Decision |
| --- | --- | --- | --- |
| Streamflow | [SDK lifecycle](https://docs.streamflow.finance/en/articles/9675175-streamflow-sdk), [locks](https://developers.streamflow.finance/docs/core-concepts/streams/locks), [OTC escrow](https://docs.streamflow.finance/en/articles/11514563-escrow), [Neodyme report](https://neodyme.io/reports/Streamflow-Protocol.pdf) | Solana token infrastructure has audit evidence. Locks release by time/price and disable cancellation. Streaming cancellation pays already-unlocked amounts to the recipient. OTC escrow exchanges tokens. These documented primitives do not establish a service-completion release gate and dispute freeze. | Not qualified for calls on current evidence. Ask for a concrete supported service-escrow primitive, IDL, and matching audit before reconsidering. |
| Solana Foundation DvP | [Program guide](https://solana.com/docs/defi/dvp-program), [source](https://github.com/solana-foundation/dvp) | Foundation documents a Cantina audit. The design atomically exchanges two token legs; either party may reclaim before settlement. Inference: a fan could withdraw before the call is settled, so this does not enforce our funded booking/dispute hold. | Reject as a direct service-booking integration. Exact deployed-build/audit mapping was not independently verified. |
| Worqen | [Project source and security status](https://github.com/Worqen-Labs/Worqen-Solana) | Service payments, SPL tokens and platform-mediated disputes are described, but the project explicitly says its external audit is pending. | Fails the user-selected audit requirement. |
| MSAFEX | [Roadmap](https://www.msafex.com/roadmap) | Service escrow and arbitration are proposed, but smart-contract development, third-party audit and testnet are upcoming phases. | Not an available audited integration on this evidence. |
| Trustless Work | [Workflow](https://www.trustlesswork.com/how-it-works), [auditor's report page](https://runtimeverification.com/public-report/trustless-work) | Milestones and release/dispute roles resemble the needed workflow, but the infrastructure is Stellar/Soroban. Auditor recommends further remediation review before significant value. | Excluded from current Solana stack. A chain migration needs a separate decision, audit review and integration evaluation. |

Audit publication establishes review of a particular scope, not safety of every product or current deployment. No production binary, upgrade authority, live fee quote, or provider service commitment was validated in this evaluation. No accounts were provisioned and no provider messages sent.

## Required integration evidence

A qualifying provider must supply the deployed mainnet and devnet program IDs, source revision and binary verification procedure, independent audit covering the escrow lifecycle and remediation, IDL/SDK, exact USDC mint/network support, and the authorities able to upgrade or move funds. The funded booking must forbid unilateral withdrawal outside disclosed cancellation rules, allow disputes to block release, support exact full/partial refunds and bounded recovery if the operator disappears. Obtain fees including creation/rent, funding, release, refund, dispute, and account closure; do not invent a price quote.

Before adoption, prove in devnet: concurrent funding and settlement, exact payer/mint/amount/booking binding, replay rejection, late funding after expiration, cancellation/release races, disputes racing release, repeated provider events, repeated refund/settlement requests, authority compromise boundaries, provider outage and terminal-account recovery. Verify every resulting transfer server-side from finalized chain state; a webhook or submitted signature alone is insufficient.

## Proposed booking policy for review

These rules are a design proposal, not implemented Terms or accepted provider capabilities. Snapshot and version the accepted policy, price, duration and participants at booking creation; keep booking, attendance, payment and settlement states separate.

- Reserve a slot for 10 minutes while awaiting funding. Confirmation requires verified escrow funding. Expired or late-funded bookings need reconciliation/refund; never silently confirm an occupied slot or ask for another payment after uncertain submission.
- Keep the full service price in escrow until verified completion and the dispute window end. Proposed completion: both authorized participants overlap for at least 90% of the booked duration, measured by verified provider events. Missing or ambiguous evidence requires review; satisfaction is a separate rating.
- Permit a full service-price refund for fan cancellation at least 24 hours before the start; creator cancellation always refunds. Late fan cancellation and fan no-show may release the price only after evidence review and the dispute window. Creator no-show refunds. Give participants a 10-minute arrival grace period.
- For connection failure or incomplete sessions, hold funds and offer a mutually accepted reschedule or evidence-based refund; do not automatically label the call completed. Partial refunds require an explicit recorded decision and provider support.
- Allow either participant to dispute within 24 hours after the scheduled end. Freeze release while disputed. A named resolver independent of the involved participants decides from attendance and submitted evidence; target seven calendar days. The resolver's identity, authority, escalation, and enforceable fallback for missed deadlines remain unresolved launch requirements.
- Release once after verified completion and the dispute window, or execute one recorded refund/dispute outcome. Operations need stable identifiers and reconciliation after timeouts; submitting a transfer does not mark it settled. Disclose nonrefundable network/provider charges separately before funding; service-price refunds must not conceal deductions.

## Next action

Seek a Solana provider offering an audited service-escrow primitive with these controls, or explicitly choose development and an independent audit of a dedicated program. Streamflow can be asked the integration evidence questions above, but its current documented primitives are not selected. A cross-chain alternative is a separate architectural decision. Do not implement or enable booking payments until a qualifying mechanism and final settlement policy are selected.

## Updated resolution direction — 2026-10-11

The user chose an initial AI-assisted decision with human verification on appeal; an appeal may have a disclosed fee. See the [prototype specification](ai-dispute-resolution-spec.md) for evidence requirements, deadline/fee proposals, exception holds and provider evaluation. This replaces the earlier blanket human-resolution proposal; it does not select an escrow provider or authorize real-money settlement.
