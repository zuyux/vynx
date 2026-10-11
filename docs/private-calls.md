# Private Daily calls — hackathon P2

A confirmed, server-verified booking provides `/calls/<booking UUID>` to its creator and fan. The fan sees it after payment; both see confirmed calls under `/dashboard/bookings`. Viewing a booking or issuing a token requires a signed wallet session and membership in that booking. Other wallets receive 404. Sharing the application link grants no access.

The server persists one random room name and two opaque participant IDs per booking before contacting Daily. Retries, including lost creation responses, recover that room and verify its configuration. Rooms are private, disable knocking, allow two participants and enforce unique participant IDs. Room-bound tokens open ten minutes before the scheduled start and expire ten minutes after the end. Room expiration ejects participants; tokens confer no owner/admin rights. Tokens stay in component memory and are supplied through Daily.js `join({url, token})`, never application URLs, local storage, the database or server logs. Like any bearer credential, a copied token grants its scoped access until expiry; the application link is the supported shareable link.

Recording is disabled for this P2. Recording consent, server-controlled capture, original media retrieval/private storage and AI dispute resolution remain separate requirements; no implicit consent or automatic recording is introduced.

## Activation

1. Apply `front/supabase/migrations/015_call_video.sql` after the previous migrations.
2. Save `DAILY_API_KEY` in `front/.env.local`; never set a `NEXT_PUBLIC_` provider secret.
3. From `front`, run `npm run setup:daily` to generate the webhook HMAC secret locally without printing it. For hosting, configure both server secrets there too.
4. Set `NEXT_PUBLIC_APP_URL` to the public HTTPS app/tunnel URL and restart the app. Run `npm run setup:daily -- --register` to create/update the matching webhook, subscribe to meeting and participant events and confirm Daily's signed setup probe. It uses exponential delivery retries. An existing matching webhook is updated rather than duplicated.
5. Complete a paid devnet booking. Open the application link with creator and fan wallets in separate browser contexts; allow camera/microphone access. Check a third wallet is denied. Join, disconnect/rejoin, then leave and wait for meeting-ended delivery. Inspect the attendance display and Daily dashboard for matching sessions.

The user waived independent auditing for this hackathon. `VYNX_BOOKING_HACKATHON=true`, alongside the existing escrow enable/program/quote configuration, permits hosted production-mode *devnet* checkout. Devnet genesis and mint checks remain enforced. This is not mainnet approval.

## Attendance evidence

`/api/daily/webhook` verifies base64 HMAC-SHA256 over the timestamp and JSON-serialized Daily event with a five-minute timestamp window. Signed test probes need no database work. Events are normalized to an allowlist, stored privately by unique provider event ID and acknowledged only after a durable insert; conflicting reuse returns 409 and failed writes return 503 for retries. Events for other Daily rooms are ignored. Participant names and provider access secrets are not retained.

Attendance matches opaque IDs to the two authorized participants, pairs joins/leaves by session ID regardless of delivery order, unions reconnect/device intervals per participant, intersects the two unions and clips the result to the booked window. Repeated deliveries, including another event ID for the same session, cannot inflate duration. Live Daily deliveries can differ slightly in the join timestamp. Differences up to 100 milliseconds are accepted using the later timestamp; larger differences remain incomplete. Missing or conflicting events, unknown participants, unmatched meeting intervals and read limits mark evidence incomplete. Browser callbacks are never evidence. The display is provisional while events arrive.

This P2 collects webhook evidence; REST reconciliation for provider delivery gaps is still pending. Attendance alone never verifies service fulfillment or releases escrow. No claims of completed recording/AI verification are made.

## Verification

Unit/API tests exercise membership, unpaid/early/expired access, provider room retry recovery, no-store responses, webhook authentication/expiry/conflicts/write failures, reconnect/device overlap and incomplete evidence. The isolated database suite checks private grants/RLS and persistent event uniqueness. The browser scenario uses real wallet sign-in, Next handlers and isolated Postgres/PostgREST for private-booking visibility and mobile widths. Provider calls in API tests are mocked. A real Daily smoke test also passed with two Chromium participants, application-issued tokens, signed webhooks persisted in the connected database, and 5.098 seconds of simultaneous attendance from six provider events. See [live evidence](daily-live-smoke.json). The fixture booking and server sessions were synthetic: this provider test did not transfer funds or claim a real paid booking. The test room, fixtures and temporary webhook were removed. The app is now deployed at https://vynx.me with the permanent webhook registered at `/api/daily/webhook`. A subsequent two-browser test through Vercel also passed with six authenticated events and 5.094 seconds of simultaneous attendance: see [Vercel evidence](daily-vercel-smoke.json).

Provider references: [private rooms](https://docs.daily.co/reference/rest-api/rooms/create-room), [meeting tokens](https://docs.daily.co/reference/rest-api/meeting-tokens/create-meeting-token), [signed webhooks and retries](https://docs.daily.co/reference/rest-api/webhooks), [participant leave durations](https://docs.daily.co/reference/rest-api/webhooks/events/participant-left).

Reproduce the live test with a running local app, an active webhook, and `npx tsx --env-file=.env.local scripts/smoke-daily.ts` from `front`. `DAILY_SMOKE_APP_URL` selects the local server; `NEXT_PUBLIC_APP_URL` must match the app’s configured request origin. The script saves evidence only after successful cleanup.

Hosted verification: from `front`, run `DAILY_SMOKE_APP_URL=https://vynx.me NEXT_PUBLIC_APP_URL=https://vynx.me npx tsx --env-file=.env.local scripts/smoke-daily.ts --deployed`. Remote smoke tests require explicit `--deployed` and the exact configured HTTPS origin. They remove their synthetic records and test room while leaving the permanent webhook active. Local `.env.local` keeps its development origin; Vercel Production uses `https://vynx.me`.
