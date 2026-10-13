import type { CreatorOffer } from './creator-draft';

export const MONTHLY_POLICY = 'vynx-monthly-devnet-v1';
export const monthlyMemo = (invoice: string) => `vynx:monthly:${invoice}`;
export type MonthlySubscription = { id: string; creator_alias: string; offer_key: string; terms: CreatorOffer; price_units: number; paid_until: string | null; stopped_at: string | null; role: 'creator' | 'fan' };
export type MonthlyInvoice = { id: string; subscription_id: string; period_start: string; period_end: string; price_units: number; state: 'awaiting_payment' | 'paid' | 'void'; expires_at: string; prepared: boolean; payment_signature: string | null; paid_at: string | null };
export type MonthlySession = { id: string; monthly_invoice_id: string; starts_at: string; ends_at: string; state: string };
export type MonthlySnapshot = { subscriptions: MonthlySubscription[]; invoices: MonthlyInvoice[]; sessions: MonthlySession[] };
export const validMonthlyId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export function renewalAvailable(subscription: MonthlySubscription, now = Date.now()) {
  return !subscription.stopped_at && (!subscription.paid_until || Date.parse(subscription.paid_until) <= now + 7 * 86400_000);
}
