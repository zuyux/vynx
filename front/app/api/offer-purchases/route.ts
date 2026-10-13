import { appDb } from '@/lib/app-db';
import { publicCreator } from '@/lib/public-creator';
import { ApiError, apiFailure, assertOrigin, requireWallet } from '@/lib/wallet-session';
import { limitPublicEndpoint } from '@/lib/public-rate-limit';
import { logServerRequest } from '@/lib/server-log';
import { validMonthlyId } from '@/lib/monthly-offer';
import { recoverExpiredMonthlyPayment, type MonthlyPaymentRecord } from '@/lib/monthly-payment';
import { buildOfferPayment, verifyOfferPayment } from '@/lib/offer-payment';
import { OFFER_PAYMENT_POLICY, offerPriceUnits, type OfferPurchase } from '@/lib/offer-purchase';

export const runtime = 'nodejs';
type PurchaseRow = OfferPurchase & MonthlyPaymentRecord & { payer_wallet: string; creator_wallet: string; creator_alias: string; offer_key: string };
const reply = (purchase: PurchaseRow, transaction?: string) => Response.json({ purchase: { id: purchase.id, terms: purchase.terms, price_units: Number(purchase.price_units), state: purchase.state, payment_signature: purchase.payment_signature }, ...(transaction ? { transaction } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError('Invalid request.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new ApiError('Request too large.', 413); }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError('Invalid request.');
    return body;
  } finally { reader.releaseLock(); }
}
export async function POST(request: Request) {
  return logServerRequest(request, '/api/offer-purchases', async () => {
    const limited = await limitPublicEndpoint(request, 'payment'); if (limited) return limited;
    try {
      assertOrigin(request);
      const wallet = await requireWallet(request), body = await readBody(request), db = appDb();
      if (!validMonthlyId(body.id) || !['checkout', 'status', 'confirm', 'recover'].includes(body.action)) throw new ApiError('Invalid offer payment.');
      async function load() {
        const { data, error } = await db.from('offer_purchases').select('*').eq('id', body.id).eq('payer_wallet', wallet).maybeSingle();
        if (error) throw new ApiError('Could not load your offer payment.', 503);
        return data as PurchaseRow | null;
      }
      let purchase = await load();
      if (!purchase && body.action === 'checkout') {
        if (body.accepted_policy !== OFFER_PAYMENT_POLICY || typeof body.alias !== 'string' || !/^[a-z0-9_]{1,30}$/.test(body.alias) || typeof body.offer !== 'string' || body.offer.length > 60) throw new ApiError('Review and accept the offer payment terms.');
        const creator = await publicCreator(body.alias);
        const offer = creator?.design.offers?.find(item => item.id === body.offer && item.type !== 'tickets' && item.billingPeriod !== 'month');
        if (!creator || !offer) throw new ApiError('Offer not found.', 404);
        if (creator.wallet === wallet) throw new ApiError('You cannot buy your own offer.');
        let units;
        try { units = offerPriceUnits(offer.price); } catch { throw new ApiError('This offer needs a valid price of at least 0.01 USDC.', 409); }
        if (body.expected_price_units !== units) throw new ApiError('The offer price changed. Reload and review it before paying.', 409);
        const { error } = await db.from('offer_purchases').insert({ id: body.id, creator_id: creator.id, creator_wallet: creator.wallet, creator_alias: creator.alias, payer_wallet: wallet, offer_key: offer.id, terms: offer, price_units: units });
        if (error && error.code !== '23505') throw new ApiError('Could not save your offer payment.', 503);
        purchase = await load();
      }
      if (!purchase) throw new ApiError('Offer payment not found.', 404);
      const original = purchase;
      if (body.action === 'status') return reply(original);
      if (body.action === 'checkout' && (body.alias !== original.creator_alias || body.offer !== original.offer_key)) throw new ApiError('This payment reference belongs to another offer.', 409);
      async function confirm(signature: string) {
        if (original.state === 'paid') {
          if (signature !== original.payment_signature) throw new ApiError('This purchase already has a different payment.', 409);
          return original;
        }
        await verifyOfferPayment(original, wallet, original.creator_wallet, signature);
        const { data, error } = await db.from('offer_purchases').update({ state: 'paid', payment_signature: signature, paid_at: new Date().toISOString() }).eq('id', original.id).eq('payer_wallet', wallet).eq('state', 'awaiting_payment').eq('transaction', original.transaction!).select('*').maybeSingle();
        if (!error && data) return data as PurchaseRow;
        const saved = await load();
        if (saved?.state === 'paid' && saved.payment_signature === signature) return saved;
        throw new ApiError('Keep the signature and retry verification without paying again.', error?.code === '23505' ? 409 : 503);
      }
      if (body.action === 'confirm') {
        if (typeof body.signature !== 'string') throw new ApiError('Provide your payment signature.');
        return reply(await confirm(body.signature));
      }
      if (original.state === 'paid') return reply(original);
      if (body.action === 'recover') {
        if (!original.transaction) return reply(original);
        const recovered = await recoverExpiredMonthlyPayment(original, wallet);
        if (recovered.signature) return reply(await confirm(recovered.signature));
        const { data, error } = await db.from('offer_purchases').update({ transaction: null, last_valid_block_height: null, quoted_slot: null }).eq('id', original.id).eq('payer_wallet', wallet).eq('state', 'awaiting_payment').eq('transaction', original.transaction).select('*').maybeSingle();
        if (error || !data) throw new ApiError('Payment changed while recovering. Reload its status.', 409);
        return reply(data as PurchaseRow);
      }
      if (original.transaction) return reply(original, original.transaction);
      const payment = await buildOfferPayment(original, wallet, original.creator_wallet);
      const { error } = await db.from('offer_purchases').update({ transaction: payment.transaction, last_valid_block_height: payment.height, quoted_slot: payment.slot }).eq('id', original.id).eq('payer_wallet', wallet).eq('state', 'awaiting_payment').is('transaction', null);
      if (error) throw new ApiError('Could not prepare your offer payment.', 503);
      const prepared = await load();
      if (!prepared) throw new ApiError('Could not recover your offer payment.', 503);
      return reply(prepared, prepared.state === 'awaiting_payment' ? prepared.transaction ?? undefined : undefined);
    } catch (reason) { return apiFailure(reason); }
  });
}
