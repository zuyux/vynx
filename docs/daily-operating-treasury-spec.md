# Vynx operating treasury and automatic Daily billing

Date: 2026-10-11. Status: specification; server worker and treasury integrations are not implemented.

## Decisions

Daily is the selected video provider. Vynx will hold its own operating funds to cover Daily usage and maintain a server-side automation service for funding, cost controls and billing reconciliation. Fans can pay for bookings in Solana USDC; Daily is paid separately through its supported conventional billing instrument.

Daily's public billing documentation describes card billing and its terms allow invoicing. Direct Solana/USDC billing or an application-controlled charge API has not been established. Use Daily's configured automatic card billing as the default; do not invent a Daily payment API. [Billing help](https://help.daily.co/en/articles/4212023-view-or-modify-your-daily-subscription), [payment terms](https://www.daily.co/legal/terms-of-service/)

“Vynx-held funds” here means a platform-owned operating treasury. It does not replace audited booking escrow or authorize spending held creator earnings, pending refunds, or disputed booking principal. Keep infrastructure funding and participant liabilities separate in both accounts and ledgers.

## Funds flow and accounting

1. Vynx funds an operating reserve with owner capital and earned, disclosed platform/infrastructure fees. Fees, beneficiaries, refund treatment and when fees become earned must be agreed and versioned before checkout.
2. Fan service payments remain in the selected audited escrow until release/refund rules permit movement. Unsettled service funds never become available operating balance.
3. Eligible platform revenue enters a separate Vynx treasury. Reconcile finalized Solana transfers before crediting spendable USDC; tracked quotes, pending transactions or customer liabilities are not usable funds.
4. If operating revenue is in USDC, a selected off-ramp/banking integration converts or transfers it into the fiat account backing the Daily billing instrument. Alternatively, a compatible crypto-funded business card may handle conversion. Provider availability, account eligibility, fees and recurring-card support require verification; neither option is selected yet.
5. Daily charges the configured billing instrument under its billing arrangement. The Vynx worker ensures funding is available and reconciles the resulting statement/invoice with usage and bank/card transactions.

The backend must not pay Daily once per booking if Daily already bills the account automatically. Booking estimates reserve operating capacity internally; they are not additional supplier charges. If invoice settlement is adopted later, use only a documented supported bank/payment rail and disable conflicting payment paths.

Suggested ledger accounts: available operating USDC, pending conversion, available operating fiat, reserved infrastructure budget, Daily accrued expense, Daily payable, paid Daily expense, refundable fee liability. Maintain service escrow liabilities separately. Track currency and exact integer units; preserve exchange rates, conversion fees and rounding adjustments. A reconciled statement must not count both an accrual and its payment as two expenses.

## Automatic server service

Implement a durable scheduled worker with persistent jobs and idempotency keys. It may run in the existing backend deployment or a dedicated worker service; no hosting platform is selected by this spec. Do not depend on an open browser, in-memory timers or an LLM to perform billing.

Responsibilities:

- Maintain a forecast from confirmed/expected calls, permitted participant minutes, recording mode, retention, contracted rates, AI costs and a configurable contingency margin. Store estimates separately from authoritative supplier bills.
- Reserve enough operating capacity before creating a room; release unused estimates after actual usage is reconciled. Limit room lifetime, participant count and recording duration to reduce uncontrolled charges.
- Monitor available operating funds, reserved budgets and expected outstanding Daily charges. On a configured threshold, initiate a bounded top-up using the chosen funding integration.
- Reconcile the funding rail, fiat/card balances and Daily billing records through supported authenticated APIs/webhooks where available. If Daily has no suitable billing API, use an approved statement ingestion/manual confirmation path; do not claim fully automatic reconciliation or use account-password browser scraping.
- Alert on low reserves, overdue/failed funding, declined/duplicate charges, reconciliation differences, expiring billing instruments and provider billing outages. Maintain funding-job logs without credentials, wallet keys or full sensitive payloads.

Proposed job types: `forecast_daily_cost`, `reserve_call_budget`, `topup_operating_balance`, `reconcile_funding_transfer`, `ingest_daily_bill`, `reconcile_daily_payment`, `release_unused_budget`. Supported connectors and credentials are prerequisites for live automation.

### Threshold and authorization policy

Use configured reserve target, minimum balance, maximum single top-up, daily/monthly conversion limits, maximum Daily usage budget and permitted destination accounts. Exact values remain open. Estimate top-up need as target reserve minus available operating balance, incorporating outstanding charges and reservations without double counting; never use escrow balance to fill the gap.

Ordinary operations within approved limits run automatically. Above-limit requests, new destinations, billing-method changes and ambiguous reconciliation enter an operator-review state. Configuration changes are privileged and audited. Workers cannot modify their own spend limits. Keep secrets in server-side secret storage and use narrowly scoped payment permissions; use a constrained signer/custody service if Solana transactions are required. Daily API credentials are separate from treasury credentials.

### Reliability and payment states

Funding operation states: `planned`, `submitted`, `confirmed`, `failed`, `reconciliation_required`. Supplier bill states: `received`, `matched`, `payment_pending`, `paid`, `failed`, `review_required`. Preserve original records and append corrections.

Derive stable top-up IDs from the funding cycle and version; enforce one active operation per treasury/cycle with a database lock. Persist external operation IDs before retrying. After an uncertain response, query the payment rail and reconcile before submitting again. Verify finalized chain state for USDC transfers and settlement status from the bank/card rail for fiat payments. A submitted signature or HTTP success is not proof that Daily was paid.

Daily charges deduplicate by supplier transaction/invoice identifier; missing identifiers require review instead of heuristic automatic payment. Verify supplier webhooks using documented authentication if provided. Reconcile amount, currency, account, billing period and tax/fee components. Do not blindly pay an email attachment or user-supplied bank destination.

## Low-funds and outage behavior

When funding is insufficient, stop accepting new paid bookings before collecting their service payment, and block new unreserved room creation. Protect already funded bookings with a provisioned operating buffer; do not interrupt active calls simply to meet a budget limit. If an existing booking cannot be delivered, notify participants and follow reschedule/refund rules rather than consuming their escrow funds.

A failed top-up is retried only when its outcome is known; pending reconciliation triggers an alert. Funding or billing outages never release a disputed booking, overwrite attendance, or mark a service completed. Recording remains required for this prototype; insufficient recording budget must not silently turn it off.

## Proposed records and controls

Persist treasury accounts with ownership/currency, funding operations, confirmed platform-revenue entries, usage estimates/actuals, room budget reservations, supplier invoices/transactions, reconciliation results, spending-policy versions and audit events. Unique external IDs and transactional ledger writes enforce idempotency.

Only privileged server workers access treasury data. No public treasury mutation endpoint; internal triggers require authenticated service identity, and operator changes require a separate privileged role. Record identifiers, amounts and outcomes in structured logs; keep private destinations and payment instruments out of public APIs and Creator Cards.

## Acceptance checks

- Escrow principal, creator liabilities, pending refunds and disputed funds never enter available operating balance.
- Forecasts and free/discounted usage are estimates; an actual Daily bill is reconciled without double charging bookings or double counting expenses.
- Concurrent workers and repeated triggers generate one top-up; timeouts, crashes and late confirmations recover without duplicate transfers.
- Daily automatic card charges reconcile once; the worker does not initiate a second supplier payment.
- Destination allowlists and spend caps reject unauthorized movement; browser users and AI evaluators cannot access treasury credentials.
- Low reserves stop new checkout before funding while existing reserved calls remain covered; failed delivery invokes the disclosed refund/reschedule flow.
- Duplicate bills, currency mismatches, missing supplier identifiers, unsupported billing ingestion and incomplete transfers enter review and emit alerts.

## Implementation sequence and open decisions

First select the operating funding rail and Daily billing instrument, configure spend limits and an initial reserve, then implement the worker against mocked supplier/funding APIs. Verify sandbox retries, reconciliation and budget gates before enabling any live treasury movement. The Daily video integration can be prototyped independently.

Open: off-ramp/card/bank provider and business-account eligibility; API permissions and Daily billing-record access; reserve/spend thresholds; fee amount and earning/refund rules; operator authority and review process; hosting/scheduling mechanism. Audited booking escrow remains an independent unresolved dependency. This specification does not claim that a server, accounts or live funding are already configured.
