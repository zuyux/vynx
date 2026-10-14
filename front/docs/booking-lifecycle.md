# Booking lifecycle

Apply `front/supabase/migrations/016_booking_lifecycle.sql` before deploying these route changes.

Awaiting-payment reservations become confirmed only after the server verifies the finalized Solana transaction and escrow receipt. Unfunded reservations retain the existing expiry checks.

Signed-in participants can POST `/api/bookings` with `{ "action": "transition", "id": "<booking UUID>", "state": "<target>" }`:

- `cancelled`: either participant, from confirmed, with the snapshotted cancellation notice (currently 24 hours).
- `completed`: the payer acknowledges completion after the scheduled end.
- `no_show`: either participant reports a no-show after the scheduled end.
- `disputed`: either participant, from confirmed/completed/no-show, until the snapshotted dispute deadline (currently 24 hours after the end).

These are participant acknowledgements/reports, not provider-certified service delivery. Row locks serialize transitions, repeated requests to the current state return the existing booking, and an audit table records changes. Replayed payment confirmation preserves later states. Only confirmed bookings may receive join tokens; paid booking history and attendance remain readable by both participants.

## Verified attendance completion

`GET /api/calls?id=<booking UUID>` returns a separate `completion` result under the versioned `attendance-v1` policy. After the scheduled end, both authorized participants must have simultaneous attendance for at least 90% of the booked duration. Time outside the booked window is excluded; reconnect intervals are unioned per participant before intersecting their presence, so overlapping devices cannot inflate completion.

The result is `pending` before the scheduled end, `verified` when complete signed evidence meets the threshold, `below_threshold` when complete evidence falls short, or `review_required` for missing, ambiguous or truncated evidence. Below-threshold attendance is not automatically a no-show. The result is recomputed from stored provider events on each read, so late deliveries can resolve missing evidence; the API does not persist a final settlement decision.

Payer acknowledgment (`state: completed`) neither overrides nor grants verified attendance completion. Satisfaction, performance ratings, and whether the promised service was fulfilled remain separate from this participation-and-duration check. Verification does not change booking state, resolve disputes, or release escrow. The private-call page displays the result and criterion separately from booking status.

Daily deliveries require server-side HMAC verification with timestamp freshness. A service-only PostgreSQL function stores each normalized event exactly once, compares duplicate contents, rejects conflicting event IDs, and returns only after durable storage. Database failures remain retryable.

Lifecycle changes do not settle or refund escrow. Cancelled funded bookings conservatively retain their time slot; escrow cancellation and dispute resolution remain separate work. Attendance evidence does not automatically complete bookings or authorize fund movement. A no-show is never inferred solely from missing provider events.

Validation: `cd front && npm run test:security:db` includes lifecycle permissions, deadlines, duplicate requests, payment replay, and conflicting provider events. Booking/video API tests cover authentication, origins, signed delivery, storage failure, and retries.

Booking payments sponsor both the Solana transaction fee and the rent for the 226-byte booking receipt and 165-byte USDC vault. The existing server quote authority is the fee payer and transfers exactly this rent to the customer immediately before escrow funding in the same atomic transaction. The customer needs only devnet USDC and must still sign. Failed funding rolls back the rent transfer. Keep the quote-authority wallet funded with devnet SOL; preparation fails closed if its balance cannot cover rent and fees. No booking-program upgrade or Kora policy change is required. Existing prepared transactions retain their original fee payer until they expire and are recovered.
