# Creator video-call offers

Apply `front/supabase/migrations/013_call_offers.sql` before using `/dashboard/bookings`. Each registered creator can save one service with a description, a 15–240 minute duration, a 0.01–1000 devnet USDC price, an IANA booking timezone, and up to 28 weekly availability windows. All boundaries use 15-minute increments. Windows must fit a complete session, stay within a day, and cannot overlap. Pausing preserves configuration.

The private `GET /api/call-offer` and `PUT /api/call-offer` endpoints require a signed wallet session and registered creator ownership. Writes require the same origin and are rate limited. The server binds ownership to the session, limits the JSON body to 16 KiB, validates fields, and stores exact integer USDC units. Anonymous and authenticated Supabase roles cannot access the table; only server-side service-role access is granted. Responses omit the wallet and private database fields. Errors use structured monitoring without full payloads.

Availability is expressed in local wall-clock time in the saved timezone. Future slot generation must handle daylight-saving gaps and repeated times explicitly, and store booked instants in UTC. Fan reservation and custom escrow checkout now have a gated development implementation; see [custom booking escrow](custom-booking-escrow.md). Production checkout remains disabled pending audit and launch requirements.

## Payment implementation dependency

The user selected audited escrow. The user subsequently selected a dedicated custom Solana program for development and independent audit; see [implementation and setup](custom-booking-escrow.md). Production checkout remains pending audit and final settlement policy; see [provider evaluation](booking-escrow-evaluation.md). Do not route upfront call payments through the existing tipping flow: it transfers funds directly to creators and does not hold funds or guarantee refunds. Before payment implementation, select the custody program/provider and define release authority, verified completion, cancellation deadlines, no-shows, connection failures, refunds, dispute handling, and recovery after failed settlement.

Pending implementation must reserve slots atomically, snapshot terms and price, bind every payment to a booking and payer, verify the transaction on the server, and enforce unique payment signatures and nonoverlapping creator bookings at the database level. Reservation expiry must account for payments submitted before expiry but confirmed later. Wallet and server retries must return the existing operation instead of initiating a second payment.

## Verification

The offer editor passed end-to-end persistence, invalid-update, origin, anonymous-access, and 320/375/430-pixel layout checks across Chrome, Firefox, WebKit, mobile Chrome, and mobile WebKit. Database security checks applied all migrations to an ephemeral Postgres database and verified restricted grants, RLS, scheduling constraints, unique creator offers, and alert recording. Lint, TypeScript checks, and the production build passed. The wider 116-test suite passed 115 tests initially; a stale sitemap expectation was corrected, then all 12 affected/domain/logging tests passed. These checks do not cover fan checkout, actual Safari devices, or a live database migration.

## Selected video provider

Daily is selected for the booking and dispute-resolution prototype. Use private rooms, server-issued participant tokens, authenticated attendance webhooks and provider recordings as specified in the [AI dispute-resolution specification](ai-dispute-resolution-spec.md). Selection is complete; integration and verification remain pending. Daily is the video provider, not the escrow or payment provider.

Vynx funds Daily through a separate platform-owned operating treasury and automatic server worker; booking escrow principal remains separate. See [Daily operating treasury](daily-operating-treasury-spec.md).
