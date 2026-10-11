import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { dispatchMonitoringAlerts, MONITORED_ROUTES, recordMonitoringEvent, sendMonitoringWebhook, type MonitoringEvent } from './error-monitoring';
import { ApiError } from './wallet-session';
import { UserFacingError } from './user-facing-error';

type RequestContext = { request_id: string; route: string; method: string; payment_failure?: Pick<MonitoringEvent, 'payment_flow' | 'outcome' | 'status'> };
const requests = new AsyncLocalStorage<RequestContext>();
type Event = 'request_completed' | 'creator_image_cleanup_pending' | 'creator_image_rollback_deferred' | 'monitoring_alert_failed';
type Fields = { status?: number; duration_ms?: number; count?: number; deleted?: number; deferred?: number; failed?: number; blocked?: number; unexpected?: boolean };
const routes = new Set([
  '/api/call-reviews', '/api/creator-history',
  '/api/calls', '/api/daily/webhook', '/api/bookings', '/api/call-offer', '/api/aliases', '/api/dashboard', '/api/profile', '/api/sponsorships',
  '/api/auth/config', '/api/auth/nonce', '/api/auth/session', '/api/tips', '/api/tips/confirm',
  '/api/actions/claim-alias', '/api/actions/claim-alias/confirm', '/api/actions/claim-alias/pending',
  '/api/actions/tip/[alias]', '/api/actions/tip/[alias]/confirm',
  '/api/monitoring/webhook', '/api/monitoring/alerts', '/api/monitoring/dispatch',
]);

// Build records from an allowlist, never by spreading caller data. Error objects,
// messages, stacks, headers, URLs, bodies, wallet addresses and signatures have
// no place in this schema.
export function serverLog(event: Event, fields: Fields = {}) {
  if (!['request_completed', 'creator_image_cleanup_pending', 'creator_image_rollback_deferred', 'monitoring_alert_failed'].includes(event)) return;
  const context = requests.getStore();
  const record: Record<string, string | number | boolean> = {
    timestamp: new Date().toISOString(),
    level: event === 'monitoring_alert_failed' ? 'error' : event === 'request_completed' ? (fields.status && fields.status >= 500 ? 'error' : fields.status && fields.status >= 400 ? 'warn' : 'info') : 'warn',
    event,
    ...(context ? { request_id: context.request_id, route: context.route, method: context.method } : {}),
  };
  for (const key of ['status', 'duration_ms', 'count', 'deleted', 'deferred', 'failed', 'blocked'] as const) {
    const value = fields[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) record[key] = Math.round(value);
  }
  if (typeof fields.unexpected === 'boolean') record.unexpected = fields.unexpected;
  // Logging must not change the response or prevent cleanup if the sink fails.
  try {
    const line = JSON.stringify(record);
    if (record.level === 'error') console.error(line);
    else if (record.level === 'warn') console.warn(line);
    else console.info(line);
  } catch { /* best-effort log sink */ }
}

// Instrument the actual confirmation operation, after authentication/body checks.
// Pending confirmations and expired quotes are normal recovery states, not alerts.
export async function monitorPaymentVerification<T>(flow: NonNullable<MonitoringEvent['payment_flow']>, verify: () => Promise<T>): Promise<T> {
  try { return await verify(); }
  catch (reason) {
    const expected = reason instanceof ApiError || reason instanceof UserFacingError;
    const code = expected && typeof reason.code === 'string' ? reason.code : '';
    if (!['PAYMENT_PENDING', 'QUOTE_EXPIRED'].includes(code)) {
      const context = requests.getStore();
      if (context) {
        const status = reason instanceof ApiError ? reason.status : expected ? 400 : 500;
        const outcome = code === 'PAYMENT_FAILED' ? 'transaction_failed'
          : ['PAYMENT_MISMATCH', 'INSUFFICIENT_PAYMENT'].includes(code) ? 'payment_mismatch'
          : status >= 500 ? 'service_error' : 'verification_rejected';
        context.payment_failure = { payment_flow: flow, outcome, status: outcome === 'service_error' && status < 500 ? 500 : status };
      }
    }
    throw reason;
  }
}

function scheduleMonitoring(response: Response, schedule: (task: () => Promise<void>) => void) {
  const context = requests.getStore();
  if (process.env.ERROR_MONITORING_ENABLED !== 'true' || !context || !MONITORED_ROUTES.includes(context.route as typeof MONITORED_ROUTES[number])) return;
  const events: MonitoringEvent[] = [];
  const base = { route: context.route, method: context.method, request_id: context.request_id };
  if (response.status >= 500) events.push({ ...base, kind: 'api_5xx', status: response.status });
  if (context.payment_failure) events.push({ ...base, kind: 'payment_verification_failed', ...context.payment_failure });
  if (!events.length) return;
  const report = async () => {
    for (const event of events) {
      try { await recordMonitoringEvent(event); }
      catch {
        serverLog('monitoring_alert_failed', { failed: 1 });
        // Keep an independent notification path when the application's database
        // is the failing dependency. This fallback cannot provide durable retry.
        try { await sendMonitoringWebhook(event, event.request_id); }
        catch { serverLog('monitoring_alert_failed', { failed: 1 }); }
      }
    }
    try {
      const result = await dispatchMonitoringAlerts();
      if (result.failed) serverLog('monitoring_alert_failed', { failed: result.failed });
    } catch { serverLog('monitoring_alert_failed', { failed: 1 }); }
  };
  try { schedule(report); }
  catch { serverLog('monitoring_alert_failed', { failed: events.length }); }
}

export async function logServerRequest(request: Request, route: string, handler: () => Promise<Response>, headers: HeadersInit = {}, schedule: (task: () => Promise<void>) => void = after) {
  // Only static route templates supplied by handlers are accepted. Never use the
  // requested URL, which can contain aliases, queries and credentials.
  const safeRoute = routes.has(route) ? route : '/api/unknown';
  const method = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'].includes(request.method) ? request.method : 'UNKNOWN';
  return requests.run({ request_id: randomUUID(), route: safeRoute, method }, async () => {
    const start = performance.now();
    let response: Response;
    let unexpected = false;
    try { response = await handler(); }
    catch {
      unexpected = true;
      response = Response.json({ error: 'Something went wrong. Please try again shortly.' }, { status: 500, headers });
      response.headers.set('Cache-Control', 'no-store');
    }
    response.headers.set('X-Request-Id', requests.getStore()!.request_id);
    if (response.headers.has('Access-Control-Allow-Origin')) {
      const exposed = response.headers.get('Access-Control-Expose-Headers');
      response.headers.set('Access-Control-Expose-Headers', exposed ? `${exposed}, X-Request-Id` : 'X-Request-Id');
    }
    serverLog('request_completed', { status: response.status, duration_ms: performance.now() - start, unexpected });
    scheduleMonitoring(response, schedule);
    return response;
  });
}
