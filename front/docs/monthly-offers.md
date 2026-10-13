# Monthly offers

Set billing to **Per month** in My Card → Offers. For bookings, choose a session duration (30, 60, 90, 120, or 180 minutes), IANA time zone, and every weekly weekday/start-time pair. Monthly offers use native Vynx checkout and do not require an external offer URL.

Customers open the offer on the public card, accept monthly terms, reserve their month, review the complete session schedule, then explicitly approve one USDC transfer in their wallet. Payments use Solana devnet test USDC and go directly to the creator. They are separate from per-session escrow; monthly refunds must be arranged with the creator. The customer pays network fees and any recipient token-account deposit.

Both parties see invoice history, paid-through dates, and scheduled calls in `/dashboard/monthly`. Confirmed monthly sessions use the existing private-call rooms, attendance, and reviews. A renewal prompt appears in the app seven days before the paid-through date. Each renewal requires a new wallet approval; there is no background charge or email/push notification. Stopping renewals preserves already-paid calls and payment recovery.

## Billing and scheduling

Enrollment snapshots the offer terms and price for subsequent renewals. Changing the public offer does not change an enrolled customer's terms. One pending invoice per subscription and one confirmed signature per invoice prevent duplicate months. Renewal before the due date starts at the previous paid-through date. Late renewal starts a new month from the payment request rather than charging for an elapsed unpaid period. Calendar-month boundaries use UTC anniversaries and retain the original day across short months (January 31 → February 28 → March 31).

Each booking invoice atomically reserves all weekly sessions in its billing period, beginning at least 15 minutes after the request. Session times remain local to the chosen time zone. Nonexistent times, clock-changing sessions, sessions crossing midnight, and conflicting creator bookings reject the reservation. Existing creator bookings and monthly sessions share the same database exclusion constraint. A session is included according to its start time and retains its full duration if it finishes after the billing boundary. A single confirmed monthly payment activates all of that invoice's sessions. Unpaid sessions cannot join private rooms.

Weekly schedule rows support an ending available hour (`endTime`, local `HH:mm`). Each row schedules one weekly session at its start time, using the chosen duration, and the full session must fit before the availability cutoff. New rows default to 09:00–17:00. Older rows retain their saved shape and display the duration-based end hour until edited. Apply `022_offer_availability_end.sql` to enforce the cutoff on monthly subscription and one-time purchase snapshots as well as card publication validation.

## Recovery

The server stores the prepared transaction and block-height validity. The client stores an invoice-specific submission guard before opening the wallet and the signature immediately after submission. Verification checks finalized chain state, the exact prepared message, paying wallet, recipient token account, USDC mint, amount, and invoice-specific memo.

Retries use the original invoice and transaction. Unprepared reservations may expire; a prepared operation keeps its session reservations until chain recovery confirms it or proves that its transaction did not land. Expired-payment recovery checks finalized height and payer history. Incomplete history fails closed and asks for the original wallet signature. No recovery action automatically sends a new payment.

## Rollout and validation

Apply `supabase/migrations/019_monthly_offers.sql` before running this feature against an existing database. It adds subscriptions/invoices and monthly references to the existing call tables. Browser roles have no direct table or RPC access; server routes enforce signed wallet ownership and origin checks.

Coverage includes real PostgreSQL migration/permissions and concurrency checks, weekly scheduling, signature uniqueness, calendar boundaries, late renewal, stopped plans, payment verification/recovery with deterministic Solana RPC, and browser publication/checkout/history/cancellation. Deterministic RPC tests do not send funds on a live network.
