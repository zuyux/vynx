# AI-first call dispute resolution — prototype specification

Date: 2026-10-11. Status: private-call P2 deployed on Vercel at vynx.me and verified against live Daily with signed attendance events; recording/AI prototype pending. Owner/support: 40230@pm.me.

## Product decision and scope

The user requests an AI-assisted initial resolution, followed by human verification if either party appeals. Human appeals may require a separate fee. This supersedes the earlier recommendation to require human review for every contested initial decision. Daily is selected as the video provider for the prototype. The user authorized a custom devnet escrow and waived the independent-audit prerequisite for the hackathon MVP. Its funded/refunded smoke test is recorded in `chain/booking-devnet-funding-smoke.json`. Mainnet production remains outside this exception. Prototype decisions and financial outcomes use simulated escrow or devnet funds.

The feature evaluates whether a booked service was delivered using the accepted offer, authenticated attendance, provider recording, and both parties' evidence. Attendance establishes participation, not fulfillment. Satisfaction and performance ratings remain separate. The system returns a reasoned initial decision, permits appeal, and generates one final settlement instruction. It does not give the LLM signing keys or authority to move funds.

Prototype languages: Spanish and English. Offer scope: one video-call service per creator. Exclude subjective guarantees such as “you will feel inspired,” externally unverifiable outcomes, and high-stakes professional advice from automatic adjudication. Such claims return insufficient evidence or out of scope.

## Proposed defaults versus committed requirements

Committed: Daily for video, AI first, human verification on appeal, potential disclosed appeal fee, consented evidence, participant authorization, deterministic attendance checks, escrow hold until finality, and separation from reviews.

Proposed prototype defaults: 24-hour dispute filing period after the scheduled end; 48-hour evidence submission period after filing; 48-hour appeal period after the decision is available to both parties; human-review target of seven calendar days; one human appeal round per dispute. These are testable defaults, not published production Terms. All times use UTC instants with localized display. Late evidence and changed decisions restart the appeal period. Missing evidence must never silently become a creator payout or fan refund.

## User journey

1. Before paying, both participants accept versioned service terms with observable deliverables, duration, recording/AI-processing consent, dispute rules and maximum appeal fees. A creator cannot change those terms for an existing booking.
2. The server creates a private provider room after payment is confirmed. Wallet sessions determine who receives creator/fan tokens. A display name or possession of a room URL grants no booking authority.
3. The call visibly indicates recording. The provider captures audio, relevant video/screenshare and server events. If either party declines recording, do not fund this prototype booking; show that recording is required before checkout. Withdrawal or recording failure during a call triggers an exception flow with funds held.
4. Either participant opens one dispute with a reason and desired outcome. Escrow is frozen immediately by the application settlement gate; the selected program must enforce the required on-chain hold too.
5. Both parties see the claim and may submit responses and supporting files. The platform fetches provider evidence independently; requiring both parties to upload a recording must not let one party block the process. Each may challenge provenance or point to relevant timestamps.
6. Deterministic verification and AI analysis produce an initial decision. Both participants see the same rationale, evidence references, proposed allocation, fee quote and exact appeal deadline. No funds move during this period.
7. Either participant may accept or appeal. Mutual acceptance finalizes early; otherwise the decision finalizes after the appeal period only if notifications/access were available and no timely appeal is pending. A server records deadline eligibility independently of a UI timer.
8. A human verifies appealed cases, reviews original evidence and may uphold, change, or decline the AI decision. Both parties receive the final reasoned outcome. Financial execution uses a separate authorized and idempotent settlement worker.

## Selected video provider: Daily

Research checked on 2026-10-11. The user selected Daily following this evaluation. Provider selection is complete; integration validation, account setup and commercial/privacy review remain pending.

| Provider | Findings | Prototype decision |
| --- | --- | --- |
| Brave Talk | Premium allows host recording; Brave documents moderator access to recordings/transcripts for 24 hours. It is based on Jitsi/8x8. The reviewed public materials did not establish supported server room/token provisioning, signed attendance webhooks, or automated recording retrieval for third-party applications. This is an evidence gap, not proof those features do not exist. | Suitable for manually collected demonstration calls only. Not selected for integrated adjudication unless Brave supplies those capabilities. |
| Daily | Documents meeting-token identity, timestamped participant webhook events, HMAC authentication, and cloud/raw-track recording. Prebuilt UI offers a short path to a prototype. | Selected for the prototype. Start with Daily Prebuilt and server-side room/token provisioning. Verify reconnect history, recording completeness, identity restrictions and server API reconciliation in an actual two-user test. |
| LiveKit | Documents server tokens, authenticated room/participant webhooks and recording through Egress, including participant and screenshare tracks. | Evaluated alternative; not selected. Reconsider only through an explicit provider-change decision if more control over tracks, deployment and UI is needed. Confirm operational cost and recording setup in a separate spike. |

Sources: [Brave Talk](https://brave.com/talk/), [Daily meeting tokens](https://docs.daily.co/reference/rest-api/meeting-tokens), [Daily participant events](https://docs.daily.co/reference/rest-api/webhooks/events/participant-joined), [Daily webhook authentication](https://docs.daily.co/reference/rest-api/webhooks), [Daily recording](https://www.daily.co/products/recording/), [LiveKit webhooks](https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/), [LiveKit Egress](https://docs.livekit.io/transport/media/ingress-egress/egress/).

Do not infer that provider attendance proves the human identity behind a wallet, that media was actually viewed, or that content was useful. Bind tokens to opaque booking participant IDs and explicit roles; do not send wallet addresses unnecessarily. Provider recording access means the provider can process plaintext media; do not promise end-to-end secrecy while server recording or AI processing is enabled.

### Daily integration requirements

Provision an unguessable private room with server-minted, room-bound, expiring meeting tokens and participant IDs. Deny guests and unauthorized third participants. Participants have no API keys or room-admin/recording-delete capability. Validate exact provider configuration in the spike rather than assuming all controls are available.

Subscribe to participant join/leave, meeting lifecycle, recording-ready and failure events supported by the API. Authenticate with Daily's documented HMAC scheme and reject replay; keep body serialization consistent with its signature specification. Use an explicit HMAC secret when registering the webhook so the first verification request is verifiable. Persist accepted events before acknowledging delivery; process expensive work asynchronously. Monitor failed webhook delivery and reconcile gaps through server APIs. Never use browser callbacks as financial evidence.

Persist `video_provider = daily` with each booking and retain the Daily room, meeting/session and recording identifiers for reconciliation. Keep Daily API and webhook credentials server-side. Use a provider adapter for room creation, participant token issuance, recording retrieval and event normalization; implement only Daily in this prototype.

Retrieve the original recording through server authorization into private storage. Test both speakers, screen share, reconnections, late arrivals, short calls and recording failure. A successful recording-ready event alone does not certify a complete recording.

### Cost estimate and fee inputs

Daily currently lists $0.004 per participant-minute after its monthly free allowance and $0.01349 per cloud video recording minute, with an additional storage rate of $0.003/minute. A 30-minute two-person call is approximately $0.6447 for video plus recording, or $0.7347 including that listed storage charge, before transcription, AI analysis, human review, taxes and other costs. This ignores free allowances and discounts and is not a final invoice estimate. Validate storage billing units/retention and recording-mode pricing before publishing fees. [Daily pricing](https://www.daily.co/pricing/video-sdk/)

Human appeal cost is separately estimated as reviewer minutes × reviewer rate plus payment/operating costs. No appeal amount is selected. Store a capped quote; never derive an automatic charge from this estimate or conceal it in the escrow allocation.

### Vynx treasury and Daily billing

Vynx will retain platform-owned operating funds for Daily costs and run a durable server worker for reserve forecasting, bounded funding and billing reconciliation. Daily uses its supported automatic card billing; direct Solana billing is not assumed. Customer service principal stays in audited escrow and is never used as an operating reserve. See the [operating treasury specification](daily-operating-treasury-spec.md) for funds flow, authorization, retry behavior, low-balance controls and implementation dependencies.

## Evidence and integrity

Authoritative evidence bundle contains booking/payment references, the immutable accepted offer/policy version, participant IDs, room/session IDs, UTC scheduled times, authenticated provider event IDs/timestamps, consent receipts, original recording object version and hash, capture start/end and known gaps. Supplementary submissions retain submitter, time, declared source and original-file hash. Matching copies uploaded by both parties are corroboration, not independent proof.

A hash detects changes after ingestion; it does not prove a recording depicts the booked call. Provenance requires authenticated provider retrieval and matching room/session metadata. Preserve original files; transcripts, translations, clips and summaries are derived artifacts linked to that original. Identify speakers from participant/track mapping when available and mark uncertain attribution. Do not infer identity from face or voice matching.

Attendance calculation unions reconnect intervals per authorized participant before intersecting their presence. Never double-count overlapping devices, recording bots or guests. Compute simultaneous attendance in the policy-defined call window and separately report published-media intervals and recording coverage. A provisional completion threshold is 90% of scheduled duration, inherited from the escrow proposal; this is necessary evidence for normal completion, not sufficient proof of service delivery. Unmatched joins/leaves, clock discrepancies, lost events or media gaps block automatic finality until reconciliation.

## AI evaluation contract

The worker receives only the minimum case bundle needed. Pin model/version, rubric, prompt, language and policy version. Store input artifact hashes, analysis run ID, cost, timestamps and structured output. Do not automatically replace an issued decision when a retry or model upgrade produces a different answer.

The rubric examines every observable promised deliverable separately. Use transcript/audio for spoken claims and relevant visual evidence for visual deliverables; transcripts alone cannot verify a screenshare task. Require evidence references to real artifact IDs and bounded timestamps. Validate references and output schema server-side. Self-reported model confidence is not a correctness guarantee.

Allowed preliminary outcomes: `release_to_creator`, `refund_to_fan`, `partial_refund`, `insufficient_evidence`, `out_of_scope`. Allocation is expressed as integer base units with exact conservation of service funds. Partial allocations require a pre-agreed rubric or human decision, not a model-invented percentage. Deterministic policy maps eligible conclusions to allowed settlement outcomes. The LLM cannot invent fees, change beneficiaries or choose a new wallet.

Suggested output fields: `case_id`, `analysis_run_id`, `policy_version`, `outcome`, `deliverable_findings[]` (met/not_met/unknown plus evidence references), `attendance_summary`, `evidence_gaps[]`, `rationale`, `proposed_allocation`, `requires_exception_review`. Unknown outcomes remain held and enter exception handling; they do not become adverse decisions simply because nobody pays an appeal fee.

Treat statements, captions, filenames, images and documents as untrusted evidence. Instructions embedded in evidence have no authority over the evaluator. The worker has no payment tools, signing keys or unrestricted network access. Reject arbitrary fetch URLs and sandbox uploaded-media processing. Limit file size, duration, supported formats and processing spend. Test prompt injection, manipulated media, mistranscription, conflicting accounts and unsupported model conclusions.

## Human appeals and fees

Either booked participant may file a reasoned appeal against the initial decision within the deadline, identifying disputed findings and any additional evidence. Timely filing freezes finalization immediately, even while fee payment is pending. One human case reviews all timely appeals; concurrent appeals cannot create contradictory settlements or uncontrolled duplicate fees.

The appeal screen shows the initial decision, fee amount/currency, whether it is refundable, waiver terms, payment deadline and review target before payment. Proposed policy: fixed capped fee; refund it when an AI error materially changes the outcome, the platform cancels review, or the promised review cannot be delivered. Provide a waiver/manual intake for inability to pay and platform/evidence failures. A fee must not make correction of a known system error impossible. These fee rules need approval before production and must be disclosed at booking.

Fee and service principal are separate ledgers. Never deduct a disputed fee from the held service price without explicit accepted rules. Bind verified fee payment to the appeal and payer, enforce unique transaction signatures and operation IDs, and handle uncertain/late payments without asking users to pay twice. Prototype fee payments are simulated/devnet only.

For an unpaid appeal, show payment/waiver deadline and send reminders. A missed deadline enters an explicit reviewable state; it must not automatically resume settlement when a waiver, payment reconciliation or platform outage is pending. The exact grace period and waiver reviewer are open decisions.

Reviewer must be independent of both parties, authenticate with a privileged role, and access only assigned cases. Show original evidence and rubric alongside AI findings, record conflicts of interest, and permit independent findings to reduce anchoring. Human outcomes include uphold, full/partial reversal, request more evidence and insufficient evidence. Record rationale, evidence references, actor and timestamp. Target seven calendar days; missed targets alert operators and keep funds held, with an escrow-supported recovery deadline to be specified.

## State model and concurrency

Keep these records distinct from booking status and from payment settlement status:

| Dispute state | Transition condition |
| --- | --- |
| `collecting_evidence` | Authorized filing; settlement gate closed |
| `evaluating` | Evidence deadline reached or both submit; immutable bundle frozen |
| `ai_decision_pending_appeal` | Validated initial decision published to both parties |
| `appeal_pending_fee` | Timely appeal filed; fee/waiver unresolved |
| `human_review` | Verified fee or waiver; independent reviewer assigned |
| `exception_hold` | Missing evidence, invalid output, infrastructure failure or inconclusive result |
| `finalized` | Mutual acceptance, uncontested eligible deadline expiry, or final human determination |

Settlement has separate `held`, `release_pending`, `refund_pending`, `split_pending`, `settled`, `failed_reconciliation` states. Case finality authorizes an outcome but does not claim a transfer occurred. An inconclusive case stays held until an explicit authorized resolution or disclosed escrow recovery rule.

Use a database lock/version check for deadline finalization versus appeal creation; a timely appeal committed first wins. Freeze an immutable evidence version for every decision. Retry job IDs and provider event IDs are unique; a worker may repeat processing but cannot issue multiple decisions or settlements. Only one final allocation per booking is active, with append-only supersession history before financial execution. At execution, recheck final version and hold status. Verify finalized chain results before marking funds settled. The audited escrow must enforce compatible release/refund/dispute authority; the app alone cannot stop a program that permits withdrawals.

## Data and proposed API boundaries

Persist `call_disputes` (unique booking, opener, deadlines, policy, state/version), `call_evidence` (private object metadata, provenance, hashes), `call_provider_events` (unique provider/event ID), `call_attendance_intervals`, `call_ai_runs`, `call_decisions`, `call_appeals`, `call_appeal_fee_payments`, `call_review_assignments`, `call_settlement_operations`, and append-only access/transition audit records. Wallet-derived participant IDs are stored server-side; public Creator Cards never expose recordings, claims, private links or dispute evidence.

Proposed routes: participant-authenticated `POST /api/bookings/:id/disputes`, `GET /api/disputes/:id`, `POST /api/disputes/:id/evidence`, `POST /api/disputes/:id/appeals`, `POST /api/appeals/:id/fee/confirm`; privileged reviewer decision route; signature-authenticated `POST /api/webhooks/daily` route. All wallet mutations enforce same-origin checks, ownership, bounded payloads and existing rate limits. Reviewer privileges are never inferred from wallet ownership alone. Private data uses RLS/restricted service access and no-store responses; uploads/downloads use short-lived signed links.

## Privacy, access and operations

Consent must explicitly explain recording, AI/provider processing, human access on appeal, fees and retention. No secret recording. Prototype uses consented test calls, not sensitive client consultations. Both participants may access the case evidence under the accepted policy; third-party identifiers in submissions may require redaction. Log metadata and error categories, never full transcripts, recordings, signed media URLs or wallet/payment secrets. Record reviewer access.

Proposed retention: original media and derived transcripts until 30 days after final resolution, then delete including provider copies where possible; an active case/appeal pauses scheduled deletion. Set a separate documented retention period for minimal financial/audit records before launch. Deletion jobs are audited and retried. Verify provider retention and AI data-use settings; do not claim “never used for training” without a supported configuration/contract. Reconsent is required for a material policy change.

Alert on recording failure, unsigned/replayed webhooks, stale attendance reconciliation, AI job failures or budget overruns, expired review targets, stuck escrow and settlement mismatches. Model/provider outage extends applicable deadlines and holds funds; absence of an appeal during an inaccessible UI must not create finality.

## Acceptance tests and evaluation

- Unauthorized wallets cannot join rooms, inspect cases/media, file appeals or alter allocations; participant IDs cannot be forged through display names. Expired/shared tokens are tested.
- Signed webhook retries and out-of-order/replayed events produce one record and correct attendance; bot presence and overlapping reconnects do not inflate completion.
- Missing recording, incomplete media, absent consent, clock mismatch and conflicting evidence produce a hold, not an invented verdict.
- Evidence instructions cannot alter the rubric, leak secrets or invoke settlement. Spanish/English transcripts, accent variation, screenshare tasks and speaker uncertainty are evaluated.
- Each AI finding references existing bounded evidence; unsupported allocations, invalid schemas and repeated run outputs cannot produce finality.
- Both sides receive the decision and deadline; appeals racing expiry, two simultaneous appeals, unpaid/waived fees, late fee confirmation and repeated payments preserve the hold and avoid duplicates.
- Humans can overturn the AI with an audited rationale; review outages never release held funds. Reviews are not automatically created or changed by dispute verdicts.
- Release/refund/split operations conserve exact integer amounts, use fixed participants and execute once under retries, crashes and reconciliation.
- Private media is absent from public queries/logs; retention deletion retries and appeal retention holds work.

Build a consented benchmark of clear delivery, nondelivery, partial delivery, no-shows, technical failures and adversarial submissions. Independent human raters label each case and disagreements are adjudicated. Measure false creator releases, false fan refunds, abstentions, unsupported evidence citations, appeal reversal rate, turnaround and per-case cost, segmented by language/service type. Do not rely on average accuracy or the model's own confidence. Set acceptable error thresholds and dataset size before any real-money rollout. Start in shadow mode: initial AI outcomes do not move real funds.

## Delivery sequence and unresolved launch decisions

1. Implement the selected Daily integration spike with two test participants; verify private identity, signed events and complete retrievable recordings.
2. Evidence pipeline, deterministic checks and mock cases; simulated escrow and fees.
3. AI evaluator, participant decision view, deadlines and human appeal workspace.
4. Adversarial/concurrency tests and shadow benchmark; confirm fee economics.
5. Only then connect a selected audited escrow through a separately tested settlement adapter.

Open decisions: escrow program/provider and recovery rules; model/video-analysis strategy; final appeal fee/refund/waiver amounts; human resolver and conflict process; final deadlines and retention; allowed service categories; benchmark release thresholds; Daily recording configuration, contractual and privacy requirements; operating funding rail, billing instrument and reserve/spend limits. Video-provider selection is resolved; Daily integration is not yet implemented. The invited-user study remains suspended. No provider subscription, credentials, external invitations or live funding are authorized by this document alone.
