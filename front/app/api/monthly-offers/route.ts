import { appDb } from '@/lib/app-db';
import { boundedJSON } from '@/lib/daily-video';
import { assertRegistryOwnership } from '@/lib/alias-registration';
import { ApiError, apiFailure, assertOrigin, requireWallet } from '@/lib/wallet-session';
import { limitPublicEndpoint } from '@/lib/public-rate-limit';
import { logServerRequest, monitorPaymentVerification } from '@/lib/server-log';
import { buildMonthlyPayment, recoverExpiredMonthlyPayment, verifyMonthlyPayment, type MonthlyPaymentRecord } from '@/lib/monthly-payment';
import { MONTHLY_POLICY, validMonthlyId } from '@/lib/monthly-offer';

export const runtime = 'nodejs';
const reply = (data: unknown) => Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
type SubscriptionRow = { id: string; creator_wallet: string; payer_wallet: string; creator_alias: string; offer_key: string; terms: Record<string, unknown>; price_units: number; paid_until: string | null; stopped_at: string | null };
type InvoiceRow = MonthlyPaymentRecord & { subscription_id: string; period_start: string; period_end: string; state: string; expires_at: string; payment_signature: string | null; paid_at: string | null };
function subscriptionResponse(s: SubscriptionRow, wallet: string) { return { id: s.id, creator_alias: s.creator_alias, offer_key: s.offer_key, terms: s.terms, price_units: Number(s.price_units), paid_until: s.paid_until, stopped_at: s.stopped_at, role: s.creator_wallet === wallet ? 'creator' : 'fan' }; }
function invoiceResponse(i: InvoiceRow) { return { id: i.id, subscription_id: i.subscription_id, period_start: i.period_start, period_end: i.period_end, price_units: Number(i.price_units), state: i.state, expires_at: i.expires_at, prepared: !!i.transaction, payment_signature: i.payment_signature, paid_at: i.paid_at }; }
async function ownedInvoice(id: unknown, wallet: string) {
  if (!validMonthlyId(id)) throw new ApiError('Invalid invoice.');
  const db = appDb();
  const { data: invoice, error } = await db.from('monthly_invoices').select('*').eq('id', id).maybeSingle();
  if (error) throw new ApiError('Could not load your invoice.', 503);
  if (!invoice) throw new ApiError('Invoice not found.', 404);
  const { data: subscription, error: subError } = await db.from('monthly_subscriptions').select('*').eq('id', invoice.subscription_id).eq('payer_wallet', wallet).maybeSingle();
  if (subError) throw new ApiError('Could not load your subscription.', 503);
  if (!subscription) throw new ApiError('Invoice not found.', 404);
  return { invoice: invoice as InvoiceRow, subscription: subscription as SubscriptionRow };
}
async function confirmInvoice(invoice: InvoiceRow, subscription: SubscriptionRow, signature: string) {
  if (invoice.state === 'paid') {
    if (invoice.payment_signature !== signature) throw new ApiError('A different payment is already recorded for this month.', 409);
    return invoice;
  }
  if (invoice.state !== 'awaiting_payment') throw new ApiError('This invoice was closed. Recover its original payment before continuing.', 409);
  await monitorPaymentVerification('booking', () => verifyMonthlyPayment(invoice, subscription.payer_wallet, subscription.creator_wallet, signature));
  const { data, error } = await appDb().rpc('confirm_monthly_payment', { invoice: invoice.id, payer: subscription.payer_wallet, signature });
  if (error) throw new ApiError('Keep the payment signature and retry verification; do not pay again.', error.code === '23505' ? 409 : 503);
  return data as InvoiceRow;
}
export async function GET(request: Request) {
  return logServerRequest(request, '/api/monthly-offers', async () => {
    try {
      const wallet = await requireWallet(request), query = new URL(request.url).searchParams;
      const db = appDb();
      if (query.has('invoice')) {
        const { invoice, subscription } = await ownedInvoice(query.get('invoice'), wallet);
        return reply({ invoice: invoiceResponse(invoice), subscription: subscriptionResponse(subscription, wallet) });
      }
      let lookup = db.from('monthly_subscriptions').select('*').or(`payer_wallet.eq.${wallet},creator_wallet.eq.${wallet}`).order('created_at', { ascending: false }).limit(100);
      if (query.has('alias')) {
        const alias = query.get('alias');
        if (!alias || !/^[a-z0-9_]{1,30}$/.test(alias)) throw new ApiError('Invalid creator alias.');
        lookup = lookup.eq('creator_alias', alias);
      }
      const { data, error } = await lookup;
      if (error) throw new ApiError('Could not load monthly plans.', 503);
      const subscriptions = (data ?? []) as SubscriptionRow[];
      if (!subscriptions.length) return reply({ subscriptions: [], invoices: [], sessions: [] });
      const { data: invoices, error: invoiceError } = await db.from('monthly_invoices').select('*').in('subscription_id', subscriptions.map(s => s.id)).order('created_at', { ascending: false }).limit(500);
      if (invoiceError) throw new ApiError('Could not load payment history.', 503);
      let sessions: unknown[] = [];
      if (invoices?.length) {
        const { data: rows, error: sessionError } = await db.from('call_bookings').select('id,monthly_invoice_id,starts_at,ends_at,state').in('monthly_invoice_id', invoices.map(i => i.id)).order('starts_at').limit(1000);
        if (sessionError) throw new ApiError('Could not load monthly sessions.', 503);
        sessions = rows ?? [];
      }
      return reply({ subscriptions: subscriptions.map(s => subscriptionResponse(s, wallet)), invoices: (invoices ?? []).map(invoiceResponse), sessions });
    } catch (reason) { return apiFailure(reason); }
  });
}
export async function POST(request: Request) {
  return logServerRequest(request, '/api/monthly-offers', async () => {
    const limited = await limitPublicEndpoint(request, 'payment'); if (limited) return limited;
    try {
      assertOrigin(request);
      const wallet = await requireWallet(request), body = await boundedJSON(request, 2048), db = appDb();
      if (body.action === 'reserve') {
        if (body.accepted_policy !== MONTHLY_POLICY) throw new ApiError('Accept the monthly payment terms.');
        let creator: { creator_wallet: string; creator_alias: string };
        if (body.subscription !== undefined) {
          if (!validMonthlyId(body.subscription)) throw new ApiError('Invalid subscription.');
          const { data, error } = await db.from('monthly_subscriptions').select('creator_wallet,creator_alias').eq('id', body.subscription).eq('payer_wallet', wallet).maybeSingle();
          if (error) throw new ApiError('Could not load your plan.', 503);
          if (!data) throw new ApiError('Plan not found.', 404);
          creator = data;
        } else {
          if (typeof body.alias !== 'string' || !/^[a-z0-9_]{1,30}$/.test(body.alias) || typeof body.offer !== 'string' || !body.offer || body.offer.length > 60) throw new ApiError('Choose a monthly offer.');
          const { data, error } = await db.from('cards_users').select('wallet_address,username').eq('username', body.alias).eq('published', true).maybeSingle();
          if (error) throw new ApiError('Could not load the creator.', 503);
          if (!data) throw new ApiError('Offer not found.', 404);
          creator = { creator_wallet: data.wallet_address, creator_alias: data.username };
        }
        await assertRegistryOwnership(creator.creator_wallet, creator.creator_alias);
        const { data, error } = await db.rpc('reserve_monthly_offer', { payer: wallet, ...(body.subscription ? { subscription: body.subscription } : { alias: body.alias, offer_key: body.offer }) });
        if (error) throw new ApiError(error.code === '23P01' ? 'One of the monthly session times is already booked. Choose another offer or contact the creator.' : error.code === 'P0002' ? 'Monthly offer not found.' : 'This plan is unavailable, its renewal is not due yet, or its schedule needs updating.', error.code === 'P0002' ? 404 : 409);
        return reply({ subscription: subscriptionResponse(data.subscription, wallet), invoice: invoiceResponse(data.invoice) });
      }
      if (body.action === 'stop') {
        if (!validMonthlyId(body.subscription)) throw new ApiError('Invalid subscription.');
        const { error } = await db.rpc('stop_monthly_subscription', { subscription: body.subscription, payer: wallet });
        if (error) throw new ApiError('Could not stop renewals.', error.code === 'P0002' ? 404 : 503);
        return reply({ ok: true });
      }
      if (body.action === 'session') {
        if (!validMonthlyId(body.id) || !['completed', 'cancelled', 'no_show'].includes(String(body.state))) throw new ApiError('Invalid session operation.');
        const { data, error } = await db.rpc('transition_monthly_session', { booking: body.id, actor: wallet, target: body.state });
        if (error) throw new ApiError('This session cannot be changed yet.', error.code === 'P0002' ? 404 : 409);
        return reply({ booking: { id: data.id, state: data.state } });
      }
      if (!['checkout', 'confirm', 'recover'].includes(String(body.action))) throw new ApiError('Invalid monthly payment operation.');
      const { invoice, subscription } = await ownedInvoice(body.invoice, wallet);
      if (body.action === 'confirm') {
        if (typeof body.signature !== 'string') throw new ApiError('Provide the wallet payment signature.');
        return reply({ invoice: invoiceResponse(await confirmInvoice(invoice, subscription, body.signature)) });
      }
      if (invoice.state === 'paid') return reply({ invoice: invoiceResponse(invoice) });
      if (invoice.state !== 'awaiting_payment') throw new ApiError('This invoice is closed. Request a new month.', 409, 'INVOICE_CLOSED');
      if (body.action === 'recover') {
        const recovered = await recoverExpiredMonthlyPayment(invoice, wallet);
        if (recovered.signature) return reply({ invoice: invoiceResponse(await confirmInvoice(invoice, subscription, recovered.signature)) });
        const { error } = await db.rpc('void_monthly_invoice', { invoice: invoice.id, payer: wallet, observed_height: recovered.height });
        if (error) throw new ApiError('Could not reset this invoice. Retry recovery.', 409);
        return reply({ invoice: invoiceResponse({ ...invoice, state: 'void' }) });
      }
      if (subscription.stopped_at) throw new ApiError('Renewals are stopped. You can still verify a previously submitted payment.', 409);
      if (!invoice.transaction) {
        if (Date.parse(invoice.expires_at) <= Date.now()) throw new ApiError('The invoice reservation expired. Recover it before requesting a new month.', 409, 'QUOTE_EXPIRED');
        const quote = await buildMonthlyPayment(invoice, wallet, subscription.creator_wallet);
        const { data, error } = await db.rpc('prepare_monthly_payment', { invoice: invoice.id, payer: wallet, encoded_transaction: quote.transaction, valid_height: quote.height, quote_slot: quote.slot });
        if (error) throw new ApiError('Could not prepare this month’s payment. Recover the invoice before retrying.', 409);
        return reply({ invoice: invoiceResponse(data), transaction: data.transaction });
      }
      // Returning the same prepared quote preserves idempotency; expiry is handled
      // through explicit recovery, never by silently creating a second payment.
      return reply({ invoice: invoiceResponse(invoice), transaction: invoice.transaction });
    } catch (reason) { return apiFailure(reason); }
  });
}
