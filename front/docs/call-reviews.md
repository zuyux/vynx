# Call reviews and public history

Apply `supabase/migrations/017_call_reviews.sql` before deploying the review and public-history routes.

Migration 017 was applied to the configured Supabase project on 2026-10-11. Live SQL and REST checks confirmed the service RPCs, RLS, browser-role restrictions, and empty summary. Application deployment is separate.

The signed-in paying fan can submit one immutable review per paid booking in `completed` state, after its scheduled end. Payer acknowledgment and attendance verification remain separate. Reviews do not require a positive rating or influence verified completion, disputes, or escrow settlement. A later dispute does not erase an existing review.

`POST /api/call-reviews` accepts `id`, four integer scores (`overall_rating`, `punctuality`, `communication`, `fulfillment`, each 1–5), and a nonempty comment up to 2000 Unicode code points. The server obtains the wallet from the signed session. The service-only SQL function locks the booking, checks payer/payment/state/time, and enforces uniqueness. An identical retry returns the existing review; different content returns a conflict. `GET /api/call-reviews?id=<UUID>` allows the payer to recover their review and eligibility. Database tables and RPCs are inaccessible to browser database roles.

The private call page shows the form to the fan and discloses that ratings/comments will be public. Comments render as plain text. Review edits and moderation are outside this implementation.

`GET /api/creator-history?alias=<published alias>&offset=0` returns `verified_completed_calls`, `review_count`, `average_rating` (null when unrated), up to 20 comments with all four scores, and `has_more`. Unpublished or invalid creators return 404. Public responses exclude wallets, payment signatures, booking IDs, participant IDs, and raw provider evidence.

Verified counts use the same `attendance-v1` verifier as private calls: ended, funded bookings in confirmed/completed/no-show/disputed states with complete signed evidence and at least 90% simultaneous attendance. Cancelled and expired bookings are excluded. The internal evidence RPC uses keyset pages of 50 bookings; full 1000-event pages are conservatively unverified. Late events are reflected on subsequent reads. Ratings and review counts aggregate all submitted reviews independently of attendance, including negative feedback. SQL computes totals/averages before paginating comments, avoiding PostgREST row-limit truncation.

The public Creator Card displays the counts, average and comments when verified calls or reviews exist. The history section stays hidden while loading and when both counts are zero. Storage failures display an error instead of fabricated zero totals. Preview and unpublished cards do not request public history.

Validation: `npm run test:security:db` covers payer access, completed/paid eligibility, scores, uniqueness, idempotent and conflicting concurrent requests, full aggregation, pagination and browser-role boundaries. Review API/unit tests cover signed sessions, origins, failures, privacy and evidence verification. `E2E_TEST_PATTERN=call-reviews.spec.ts npm run test:e2e` covers the fan form through the API/database to the public card, negative feedback independence, escaped comments, mobile layout and the empty state against isolated PostgreSQL/PostgREST.
