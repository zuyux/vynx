import type { SupabaseClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';
import { appDb } from './app-db';

export const MONITORED_ROUTES = [
  '/api/call-offer', '/api/aliases', '/api/dashboard', '/api/profile', '/api/sponsorships',
  '/api/auth/nonce', '/api/auth/session', '/api/tips', '/api/tips/confirm',
  '/api/actions/claim-alias', '/api/actions/claim-alias/confirm', '/api/actions/claim-alias/pending',
  '/api/actions/tip/[alias]', '/api/actions/tip/[alias]/confirm',
] as const;
const methods = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'];
export type MonitoringEvent = {
  kind: 'api_5xx' | 'payment_verification_failed'; route: string; method: string;
  status: number; request_id: string;
  payment_flow?: 'tip' | 'alias_claim' | 'sponsorship';
  outcome?: 'transaction_failed' | 'payment_mismatch' | 'verification_rejected' | 'service_error';
};

// Reject unexpected properties on webhook input. No free-text error or payload
// field is accepted, even from an authenticated sender.
export function monitoringEvent(value: unknown): MonitoringEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => !['kind', 'route', 'method', 'status', 'request_id', 'payment_flow', 'outcome'].includes(key))) return null;
  if (!MONITORED_ROUTES.includes(data.route as typeof MONITORED_ROUTES[number]) || !methods.includes(data.method as string)
    || typeof data.request_id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(data.request_id)
    || typeof data.status !== 'number' || !Number.isInteger(data.status)) return null;
  if (data.kind === 'api_5xx') {
    if (data.status < 500 || data.status > 599 || data.payment_flow !== undefined || data.outcome !== undefined) return null;
    return { kind: data.kind, route: data.route as string, method: data.method as string, status: data.status, request_id: data.request_id };
  }
  if (data.kind !== 'payment_verification_failed' || data.status < 400 || data.status > 599
    || !['tip', 'alias_claim', 'sponsorship'].includes(data.payment_flow as string)
    || !['transaction_failed', 'payment_mismatch', 'verification_rejected', 'service_error'].includes(data.outcome as string)) return null;
  return { kind: data.kind, route: data.route as string, method: data.method as string, status: data.status, request_id: data.request_id,
    payment_flow: data.payment_flow as MonitoringEvent['payment_flow'], outcome: data.outcome as MonitoringEvent['outcome'] };
}

export function monitoringAuthorized(request: Request, token = process.env.ERROR_MONITORING_TOKEN) {
  if (!token || token.length < 32) return false;
  const supplied = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${token}`;
  return Buffer.byteLength(supplied) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export async function recordMonitoringEvent(event: MonitoringEvent, db: SupabaseClient = appDb()) {
  const safe = monitoringEvent(event);
  if (!safe) throw new Error('Invalid monitoring event');
  const { error } = await db.rpc('record_error_alert', { alert: safe }).abortSignal(AbortSignal.timeout(2000));
  if (error) throw new Error('Monitoring storage unavailable');
}

export async function sendMonitoringWebhook(event: MonitoringEvent, idempotencyKey: string, fetcher = fetch) {
  const safe = monitoringEvent(event);
  if (!safe) throw new Error('Invalid monitoring event');
  const endpoint = process.env.ERROR_ALERT_WEBHOOK_URL;
  if (!endpoint) return false;
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid alert destination');
  const response = await fetcher(url, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(3000),
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey,
      ...(process.env.ERROR_ALERT_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.ERROR_ALERT_WEBHOOK_TOKEN}` } : {}) },
    body: JSON.stringify(safe),
  });
  const delivered = response.ok;
  await response.body?.cancel();
  return delivered;
}

// A delivery lease prevents overlapping workers from sending the same alert.
// Failed deliveries remain in the database for bounded exponential retries.
export async function dispatchMonitoringAlerts(db: SupabaseClient = appDb(), fetcher = fetch) {
  const endpoint = process.env.ERROR_ALERT_WEBHOOK_URL;
  if (!endpoint) return { sent: 0, failed: 0, configured: false };
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid alert destination');
  const { data, error } = await db.rpc('claim_error_alerts').abortSignal(AbortSignal.timeout(2000));
  if (error || !Array.isArray(data)) throw new Error('Monitoring queue unavailable');
  const result = { sent: 0, failed: 0, configured: true };
  for (const job of data) {
    let delivered = false;
    try {
      const event = monitoringEvent(job.event);
      if (!event) throw new Error('Invalid stored event');
      delivered = await sendMonitoringWebhook(event, job.id, fetcher);
    } catch { /* no URL, response body or exception is logged */ }
    const { error: finishError } = await db.rpc('finish_error_alert', {
      alert_id: job.id, delivery_lease: job.lease_id, delivered,
    }).abortSignal(AbortSignal.timeout(2000));
    if (finishError) throw new Error('Monitoring queue unavailable');
    if (delivered) result.sent++; else result.failed++;
  }
  return result;
}
