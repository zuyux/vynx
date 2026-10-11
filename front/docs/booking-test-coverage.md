# Booking automated verification

Run from the repository root:

```sh
cd front
npm test
npm run test:security:db
cd ../chain
node --test tests/booking.test.cjs
```

The database suite starts an isolated PostgreSQL 17 Docker container, applies all migrations, and removes the container afterward. The escrow suite executes the compiled `chain/target/deploy/vynx_booking.so` in LiteSVM; rebuild that artifact when changing the Rust program.

| Behavior | Automated evidence |
| --- | --- |
| Booking authorization | Booking API rejects missing sessions and cross-origin mutations; database checks reject creator/outsider payment confirmation and outsider checkout/transitions. Video API restricts room tokens and evidence to participants. |
| Slot conflicts | Database exclusion constraint rejects overlaps, allows adjacent slots, retains funded slots, and releases expired unfunded slots only after blockhash expiry. Concurrent overlapping reservations have one winner; identical reservation retries return one booking. |
| Payment retries | API checks finalized transaction and escrow receipt before confirmation. Concurrent checkout returns one transaction/block height; conflicting confirmations have one winner; identical retries succeed. Payment replay preserves completed/cancelled states; reused signatures cannot fund another booking. |
| Attendance event retries | Signed webhook rejects invalid signatures, returns a retryable failure when storage fails, and acknowledges durable retries. Real database concurrent identical deliveries store one event; conflicting event IDs have one winner. |
| Review eligibility | Database rejects creators, outsiders, unpaid/uncompleted/future bookings and invalid scores/comments. Identical retries retain one immutable review; concurrent conflicting reviews have one winner. |
| Rating aggregation | Database checks zero-review null rating, all-review average rounding (22 reviews, 4.82), comment pagination, retention of negative feedback after a dispute, and absence of private fields. |
| Refund/settlement | LiteSVM checks authorities, recipient ownership, dispute freeze, exact cancellation/dispute/recovery deadlines, zero/partial/full allocation, token conservation, and rejection of repeated settlement/refunding/refunding an already settled booking. |

These verify the implemented database, API and escrow rules. Lifecycle transitions and attendance verification do not move escrow funds. Resolver orchestration and production deployment verification remain separate work.
