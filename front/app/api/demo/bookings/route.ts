import { logServerRequest } from '@/lib/server-log';
import { appDb } from '@/lib/app-db';
import { ApiError, apiFailure, assertOrigin, requireWallet } from '@/lib/wallet-session';
import { limitPublicEndpoint } from '@/lib/public-rate-limit';
import { availableCallSlots, callSlots } from '@/lib/call-slots';
import { DEMO_BOOKING_POLICY, DEMO_CALL_OFFER } from '@/lib/demo-booking';

export const runtime = 'nodejs';
const reply = (data: unknown) => Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
function enabled() {
  if (process.env.VYNX_DEMO_BOOKINGS_ENABLED !== 'true') throw new ApiError('Demo bookings are disabled.', 404);
}
export async function GET(request: Request) {
  return logServerRequest(request, '/api/demo/bookings', async () => {
  try {
    enabled();
    const limited = await limitPublicEndpoint(request, 'mutation'); if (limited) return limited;
    const { data, error } = await appDb().from('demo_call_bookings').select('starts_at,ends_at').gt('ends_at', new Date().toISOString());
    if (error) throw new ApiError('Could not load demo slots.', 503);
    return reply({ offer: DEMO_CALL_OFFER, policy: DEMO_BOOKING_POLICY, slots: availableCallSlots(callSlots(DEMO_CALL_OFFER), 30, data ?? []) });
  } catch (error) { return apiFailure(error); }
  });
}
export async function POST(request: Request) {
  return logServerRequest(request, '/api/demo/bookings', async () => {
  if (process.env.VYNX_DEMO_BOOKINGS_ENABLED !== 'true') return apiFailure(new ApiError('Demo bookings are disabled.', 404));
  const limited = await limitPublicEndpoint(request, 'mutation'); if (limited) return limited;
  try {
    assertOrigin(request);
    const wallet = await requireWallet(request);
    const reader = request.body?.getReader();
    if (!reader) throw new ApiError('Invalid request.');
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 2048) { await reader.cancel(); throw new ApiError('Request too large.', 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const raw = Buffer.concat(chunks).toString('utf8');
    let body;
    try { body = JSON.parse(raw); } catch { throw new ApiError('Invalid request.'); }
    if (!body || body.accepted_policy !== DEMO_BOOKING_POLICY || typeof body.request_id !== 'string'
      || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(body.request_id)
      || typeof body.slot !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(body.slot)
      || !Number.isFinite(Date.parse(body.slot)) || new Date(body.slot).toISOString() !== body.slot
      || typeof body.timezone !== 'string' || body.timezone.length > 100) throw new ApiError('Accept the terms and choose a valid slot.');
    try { new Intl.DateTimeFormat('en', { timeZone: body.timezone }); } catch { throw new ApiError('Invalid timezone.'); }
    const { data, error } = await appDb().rpc('reserve_demo_call', {
      payer: wallet, request_id: body.request_id, slot: body.slot, accepted_policy: body.accepted_policy, viewer_timezone: body.timezone,
    });
    if (error) throw new ApiError(error.code === '23505' || error.code === '23P01' ? 'This demo slot is already reserved.' : error.code === '22023' ? 'Invalid slot or conflicting retry.' : 'Could not reserve the demo slot.', ['23505','23P01','22023'].includes(error.code) ? 409 : 503);
    return reply({ booking: { id: data.id, starts_at: data.starts_at, ends_at: data.ends_at, terms: data.terms, accepted_at: data.accepted_at } });
  } catch (error) { return apiFailure(error); }
  });
}
