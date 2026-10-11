import { appDb } from '@/lib/app-db';
import { apiFailure, ApiError, assertOrigin, requireWallet } from '@/lib/wallet-session';
import { limitPublicEndpoint } from '@/lib/public-rate-limit';
import { logServerRequest } from '@/lib/server-log';
import { attendance, verifiedCompletion, assertPrivateRoom, boundedJSON, callWindow, dailyRequest, roomProperties, tokenProperties, type VideoRoom } from '@/lib/daily-video';

const reply = (body: unknown) => Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
const columns = 'id,creator_wallet,payer_wallet,starts_at,ends_at,state,payment_signature,terms';
async function participant(id: unknown, wallet: string) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new ApiError("Invalid booking.");
  const { data, error } = await appDb().from('call_bookings').select(columns).eq('id', id).maybeSingle();
  if (error) throw new ApiError("Could not load the booking.", 503);
  if (!data || ![data.creator_wallet, data.payer_wallet].includes(wallet)) throw new ApiError('Booking not found.', 404);
  if (!data.payment_signature) throw new ApiError("Confirm the booking payment first.", 409);
  return data;
}
function summary(b: { id: string; starts_at: string; ends_at: string; creator_wallet: string; terms: Record<string, unknown>; state: string }, wallet: string) {
  return { id: b.id, state: b.state, starts_at: b.starts_at, ends_at: b.ends_at, title: b.terms.title, role: wallet === b.creator_wallet ? 'creator' : 'fan', call_path: `/calls/${b.id}` };
}
export async function GET(request: Request) {
  return logServerRequest(request, '/api/calls', async () => {
    try {
      const wallet = await requireWallet(request), id = new URL(request.url).searchParams.get('id');
      if (!id) {
        // Wallet is validated by the signed session; never interpolate arbitrary query input.
        const { data, error } = await appDb().from('call_bookings').select(columns).in('state', ['confirmed', 'completed', 'cancelled', 'no_show', 'disputed'])
          .or(`creator_wallet.eq.${wallet},payer_wallet.eq.${wallet}`).order('starts_at', { ascending: false }).limit(100);
        if (error) throw new ApiError("Could not load your calls.", 503);
        return reply({ calls: (data ?? []).map(b => summary(b, wallet)) });
      }
      const booking = await participant(id, wallet);
      const db = appDb();
      const { data: room, error } = await db.from('call_video_rooms').select('*').eq('booking_id', id).maybeSingle();
      if (error) throw new ApiError("Could not load the call.", 503);
      let evidence = null;
      if (room) {
        const { data: events, error: eventError } = await db.from('call_video_events').select('event_id,event_type,event_ts,payload').eq('booking_id', id).order('event_ts').limit(1000);
        if (eventError) throw new ApiError("Could not load attendance.", 503);
        evidence = attendance(events ?? [], room, booking.starts_at, booking.ends_at);
        if (events?.length === 1000) evidence = { ...evidence, evidence_status: 'incomplete', gaps: [...evidence.gaps, 'event_limit'] };
      }
      const completion = verifiedCompletion(evidence, booking.starts_at, booking.ends_at);
      return reply({ call: summary(booking, wallet), attendance: evidence, completion, recording_enabled: false });
    } catch (reason) { return apiFailure(reason); }
  });
}
export async function POST(request: Request) {
  return logServerRequest(request, '/api/calls', async () => {
    const limited = await limitPublicEndpoint(request, 'mutation'); if (limited) return limited;
    try {
      assertOrigin(request);
      const wallet = await requireWallet(request), body = await boundedJSON(request);
      const booking = await participant(body.id, wallet), window = callWindow(booking.starts_at, booking.ends_at);
      if (booking.state !== 'confirmed') throw new ApiError('This booking is no longer open for joining.', 409);
      const now = Date.now() / 1000;
      if (now < window.nbf) throw new ApiError("You can join 10 minutes before your booked time.", 409, 'CALL_EARLY');
      if (now >= window.exp) throw new ApiError("Access to this call has ended.", 410, 'CALL_ENDED');
      if (!process.env.DAILY_API_KEY || !process.env.DAILY_WEBHOOK_HMAC_BASE64) throw new ApiError("The video provider is not configured yet.", 503, 'VIDEO_UNAVAILABLE');
      const db = appDb();
      // Persist the randomly generated room name and opaque identities first. Concurrent
      // retries retain the same name even after a provider request times out.
      const { error: allocationError } = await db.from('call_video_rooms').upsert({ booking_id: booking.id }, { onConflict: 'booking_id', ignoreDuplicates: true });
      if (allocationError) throw new ApiError("Could not prepare the call.", 503);
      const { data, error } = await db.from('call_video_rooms').select('*').eq('booking_id', booking.id).single();
      if (error || !data) throw new ApiError("Could not prepare the call.", 503);
      const room = data as VideoRoom;
      // POST /rooms is not idempotent. An already-created room (including a lost
      // response) is recovered and its access restrictions are checked before token issuance.
      let providerRoom;
      try { providerRoom = await dailyRequest('rooms', { name: room.room_name, privacy: 'private', properties: roomProperties(booking.starts_at, booking.ends_at) }); }
      catch { providerRoom = await dailyRequest(`rooms/${encodeURIComponent(room.room_name)}`); }
      const url = assertPrivateRoom(providerRoom, room.room_name, booking.starts_at, booking.ends_at);
      const role = wallet === booking.creator_wallet ? 'creator' : 'fan';
      const issued = await dailyRequest('meeting-tokens', { properties: tokenProperties(room, role, booking.starts_at, booking.ends_at) });
      if (typeof issued.token !== 'string' || !issued.token) throw new ApiError("Could not prepare private access.", 503);
      return reply({ url, token: issued.token, expires_at: new Date(window.exp * 1000).toISOString() });
    } catch (reason) { return apiFailure(reason); }
  });
}
