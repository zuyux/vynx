# Error monitoring and webhook alerts

The app records API 5xx responses and failed payment confirmation operations in a persistent operator inbox. This covers SOL/USDC tips, public Solana Actions, legacy/registry alias claims, and sponsorship verification. Authentication/body failures before confirmation do not create payment alerts. `PAYMENT_PENDING` and `QUOTE_EXPIRED` are expected recovery states and do not alert. Sponsorship transaction failures and mismatches have distinct fixed codes; campaign activation storage failures return 503 so they also alert.

## Activate

1. Apply `front/supabase/migrations/011_error_monitoring.sql` after migration 010.
2. Run `npm run setup:monitoring` from `front`. This creates `ERROR_MONITORING_TOKEN` in the ignored `.env.local`, preserves existing configuration, and never prints the token. Copy this server-only setting to your hosting environment through its secret manager.
3. Set `ERROR_MONITORING_ENABLED=true` and restart/redeploy. Environment validation requires an operator token of at least 32 characters. Monitoring is disabled by default until the migration is applied.
4. Use the operator token to access `GET /api/monitoring/alerts`. It returns the latest 100 alert groups with occurrence counts, timestamps, and delivery state. This is the built-in alert destination and works without an external service.

## Created webhook endpoint

`POST /api/monitoring/webhook` accepts authenticated events. Send `Authorization: Bearer <ERROR_MONITORING_TOKEN>` and `Content-Type: application/json`. The request body is limited to 4 KiB. Unauthorized requests return 401, malformed or extra fields return 400, oversized bodies return 413, storage failures return 503, and accepted events return 202. Successful retries with the same request ID and kind do not increment counts again. Authorized intake and dispatch also consume the mutation rate limit.

Example body:

```json
{
  "kind": "api_5xx",
  "route": "/api/tips/confirm",
  "method": "POST",
  "status": 503,
  "request_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
}
```

Payment events use `kind: "payment_verification_failed"` and also require `payment_flow` (`tip`, `alias_claim`, `sponsorship`) and `outcome` (`transaction_failed`, `payment_mismatch`, `verification_rejected`, `service_error`). Routes must be one of the fixed business API templates; dynamic aliases are rejected. Only 5xx statuses are accepted for `api_5xx`; payment failures accept 4xx/5xx.

Application failures call the same intake logic internally after the response using Next.js `after`, avoiding a self-request and preserving payment response latency and semantics. Monitoring endpoints are excluded from automatic alert capture to prevent recursion. The operator API uses bearer authentication, never wallet sessions, and does not expose a public inbox or browser CORS access.

## Optional outbound notifications

Set `ERROR_ALERT_WEBHOOK_URL` to an HTTPS receiver to forward inbox alerts. If needed, set the separate `ERROR_ALERT_WEBHOOK_TOKEN` to supply a bearer credential to that receiver. Embedded URL credentials and redirects are rejected. Outbound bodies use the exact event schema above, with an `Idempotency-Key` header identifying the alert group. The built-in intake endpoint can receive this schema; forwarding to your own inbox is unnecessary because application events are already stored there.

Repeated failures with the same kind, route, method, status, flow, and outcome are grouped into five-minute windows. The first request ID stays stable for delivery retries; occurrence counts and last-seen timestamps remain available in the inbox. One notification is delivered per group/window. Delivery is at least once; receivers should honor the idempotency key. Operator data is retained for 30 days with bounded cleanup during intake.

New failures trigger a delivery sweep after recording. Schedule `npm run alerts:dispatch` from `front` every five minutes to retry pending deliveries when no new failures occur. It loads server-only environment settings and calls the protected `POST /api/monitoring/dispatch` endpoint; no token needs to appear on the command line. For example, on a host with cron:

```cron
*/5 * * * * cd /absolute/path/to/vynx/front && npm run alerts:dispatch
```

Each sweep claims at most five alerts with two-minute leases, preventing simultaneous workers from claiming the same delivery. Non-2xx responses, timeouts, and network errors retain alerts for exponential retry starting at one minute, capped at one hour and ten attempts. Inbox rows with ten attempts and no `delivered_at` need operator attention. Per-call persistence timeout is two seconds; outbound timeout is three seconds. Monitoring failures never replace a payment response and emit the safe `monitoring_alert_failed` server event.

If the database is unavailable, a configured external receiver still gets a direct best-effort notification. That fallback has no durable retry or five-minute grouping. Without an external receiver, database outages can only appear in structured server logs until storage recovers. Monitor `monitoring_alert_failed` in your hosting logs as well.

## Privacy and response

Stored and forwarded events contain only fixed categories, static routes, HTTP methods/statuses, and generated request IDs. No request/response bodies, exception messages/stacks, query strings, IPs, cookies, credentials, wallet addresses, aliases, or transaction signatures are accepted. Unknown webhook fields are rejected in both application validation and the database function. Tables use RLS and tables/functions are restricted to `service_role`.

Correlate an alert's request ID with `request_completed` logs and the response's `X-Request-Id`. A verification or recording failure does not authorize charging again; retain the customer's signature privately and use the existing confirmation/reconciliation flow. For infrastructure failures, check RPC, database, and sponsorship service health. Restore the receiver and run dispatch for queued delivery failures.

## Validation

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` in `front`. Run `npm run test:monitoring:db` with Docker for isolated PostgreSQL validation of the migration, access control, duplicate intake, grouping, leases, capped retries, and concurrent aggregation. After a build, `npm run test:monitoring:http` starts a temporary production server and local database fixture to verify real Next.js `after` capture for an API 503 and a public Action verification failure. It does not contact live payment services.
