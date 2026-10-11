import { logServerRequest, monitorPaymentVerification } from '@/lib/server-log';
import { appDb } from '@/lib/app-db';
import { ApiError, apiFailure, assertOrigin, requireWallet } from '@/lib/wallet-session';
import { limitPublicEndpoint } from '@/lib/public-rate-limit';
import { assertRegistryOwnership } from '@/lib/alias-registration';
import { CALL_OFFER_COLUMNS, callOfferResponse } from '@/lib/call-offer';
import { callSlots, availableCallSlots } from '@/lib/call-slots';
import { bookingAddresses, buildBookingPayment, escrowContext, escrowProgram, verifyBookingPayment, type CallBooking } from '@/lib/booking-escrow';

export const runtime = 'nodejs';
const reply = (data: unknown) => Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
function publicBooking(b: CallBooking) { return { id: b.id, starts_at: b.starts_at, ends_at: b.ends_at, expires_at: b.expires_at, terms: b.terms, price_units: b.price_units, state: b.state, signature: b.payment_signature }; }
async function confirm(b: CallBooking, signature: string) {
  await monitorPaymentVerification('booking', () => verifyBookingPayment(b, signature));
  const { data, error } = await appDb().rpc('confirm_call_payment', { booking_id: b.id, payer: b.payer_wallet, signature });
  if (error) throw new ApiError("Keep the signature and verify again; do not pay again.", error.code === '23505' ? 409 : 503);
  return data as CallBooking;
}
async function reconcile(offer: string) {
  const db = appDb();
  const { data, error } = await db.from('call_bookings').select('*').eq('offer_id', offer).eq('state', 'awaiting_payment').lt('expires_at', new Date().toISOString()).limit(100);
  if (error) throw new ApiError("Could not check bookings.", 503);
  if (!data?.length) return;
  const { connection, program } = await escrowContext();
  const height = await connection.getBlockHeight('finalized');
  for (const row of data as CallBooking[]) {
    if (row.transaction) {
      const address = bookingAddresses(program, row.id).booking;
      if (await connection.getAccountInfo(address, 'finalized')) {
        // A payment landed before expiry but was finalized later. Confirm its
        // original operation instead of releasing the slot or asking for payment.
        const signatures = await connection.getSignaturesForAddress(address, { limit: 20 }, 'finalized');
        for (const s of signatures.filter(s => !s.err).reverse()) {
          try { await confirm(row, s.signature); break; }
          catch (e) { if (!(e instanceof ApiError) || e.code !== 'PAYMENT_MISMATCH') throw e; }
        }
        continue;
      }
      if (height <= Number(row.last_valid_block_height)) continue;
    }
    const { error: expiryError } = await db.rpc('expire_call_reservation', { booking_id: row.id, observed_height: height });
    if (expiryError) throw new ApiError("Could not reconcile the time slot.", 503);
  }
}
async function readBookingBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("Invalid request.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new ApiError('Request too large.', 413); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { reader.releaseLock(); }
}
async function findOffer(alias: unknown) {
  if (typeof alias !== 'string' || !/^[a-z0-9_]{1,30}$/.test(alias)) throw new ApiError("Invalid alias.");
  const db = appDb();
  const { data: creator, error } = await db.from('cards_users').select('wallet_address').eq('username', alias).maybeSingle();
  if (error) throw new ApiError("Could not load the creator.", 503);
  if (!creator) throw new ApiError('Creator not found.', 404);
  await assertRegistryOwnership(creator.wallet_address, alias);
  const { data: offer, error: offerError } = await db.from('call_offers').select(`${CALL_OFFER_COLUMNS},creator_wallet`).eq('creator_wallet', creator.wallet_address).maybeSingle();
  if (offerError) throw new ApiError("Could not load the service.", 503);
  if (!offer?.accepting) throw new ApiError("This creator is not accepting bookings.", 404);
  return offer;
}
export async function GET(request: Request) {
  return logServerRequest(request, '/api/bookings', async () => {
  try {
    escrowProgram();
    const limited = await limitPublicEndpoint(request, 'payment'); if (limited) return limited;
    const query = new URL(request.url).searchParams;
    if (query.has('id')) {
      const wallet = await requireWallet(request), id = query.get('id');
      if (!uuid(id)) throw new ApiError("Invalid booking.");
      const { data, error } = await appDb().from('call_bookings').select('*').eq('id', id).eq('payer_wallet', wallet).maybeSingle();
      if (error) throw new ApiError("Could not recover the booking.", 503);
      if (!data) throw new ApiError('Booking not found.', 404);
      return reply({ booking: publicBooking(data) });
    }
    const offer = await findOffer(query.get('alias'));
    await reconcile(offer.id);
    const { data, error } = await appDb().from('call_bookings').select('starts_at,ends_at').eq('creator_wallet', offer.creator_wallet).neq('state', 'expired').gt('ends_at', new Date().toISOString());
    if (error) throw new ApiError("Could not load time slots.", 503);
    return reply({ offer: callOfferResponse(offer), slots: availableCallSlots(callSlots(offer), offer.duration_minutes, data ?? []) });
  } catch (reason) { return apiFailure(reason); }
  });
}
export async function POST(request: Request) {
  return logServerRequest(request, '/api/bookings', async () => {
  const limited = await limitPublicEndpoint(request, 'payment');
  if (limited) return limited;
  try {
    escrowProgram(); assertOrigin(request);
    const wallet = await requireWallet(request);
    const body = await readBookingBody(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError("Invalid request.");
    const db = appDb();
    if (body.action === 'reserve') {
      if (body.accepted_policy !== 'vynx-escrow-devnet-v1' || typeof body.slot !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(body.slot) || !Number.isFinite(Date.parse(body.slot))) throw new ApiError("Accept the terms and choose a valid time slot.");
      const offer = await findOffer(body.alias);
      await reconcile(offer.id);
      const { data, error } = await db.rpc('reserve_call', { offer: offer.id, payer: wallet, slot: body.slot });
      if (error) throw new ApiError("This slot is already booked or is no longer available.", 409, 'SLOT_UNAVAILABLE');
      return reply({ booking: publicBooking(data) });
    }
    if (!['checkout', 'confirm'].includes(body.action) || !uuid(body.id)) throw new ApiError("Invalid operation.");
    const { data: row, error } = await db.from('call_bookings').select('*').eq('id', body.id).eq('payer_wallet', wallet).maybeSingle();
    if (error) throw new ApiError("Could not load the booking.", 503);
    if (!row) throw new ApiError('Booking not found.', 404);
    const b = row as CallBooking;
    if (body.action === 'confirm') {
      if (typeof body.signature !== 'string') throw new ApiError('Signature required.');
      return reply({ booking: publicBooking(await confirm(b, body.signature)) });
    }
    if (b.state === 'confirmed') return reply({ booking: publicBooking(b) });
    if (b.state !== 'awaiting_payment' || Date.parse(b.expires_at) <= Date.now()) throw new ApiError("The reservation expired. If you submitted payment, verify its signature.", 409, 'RESERVATION_EXPIRED');
    if (b.transaction) return reply({ booking: publicBooking(b), transaction: b.transaction });
    const payment = await buildBookingPayment(b);
    const { data, error: prepareError } = await db.rpc('prepare_call_payment', { booking_id: b.id, payer: wallet, encoded_transaction: payment.transaction, valid_height: payment.height });
    if (prepareError) throw new ApiError("Could not prepare payment. Recover the booking before retrying.", 409);
    return reply({ booking: publicBooking(data), transaction: data.transaction });
  } catch (reason) { return apiFailure(reason); }
  });
}
