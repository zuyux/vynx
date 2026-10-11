import { appDb } from '@/lib/app-db';
import { apiFailure, ApiError } from '@/lib/wallet-session';
import { logServerRequest } from '@/lib/server-log';
import { boundedJSON, normalizedEvent, verifyDailyWebhook } from '@/lib/daily-video';

export async function POST(request: Request) {
  return logServerRequest(request, '/api/daily/webhook', async () => {
    try {
      const body = await boundedJSON(request, 65_536);
      verifyDailyWebhook(request.headers, body);
      if (body.test === 'test') return Response.json({ received: true });
      const event = normalizedEvent(body);
      if (!event) return Response.json({ received: true });
      const db = appDb();
      const { data: room, error } = await db.from('call_video_rooms').select('booking_id').eq('room_name', event.payload.room).maybeSingle();
      if (error) throw new ApiError('Event storage unavailable.', 503);
      // Other Daily rooms can share a domain webhook; they are outside our bookings.
      if (!room) return Response.json({ received: true });
      const { error: insertError } = await db.rpc('record_call_video_event', { ...event, booking_id: room.booking_id });
      if (insertError) throw new ApiError(insertError.code === '23505' ? 'Conflicting event ID.' : 'Event storage unavailable.', insertError.code === '23505' ? 409 : 503);
      // Acknowledge only after durable insert, so provider retries recover database failures.
      return Response.json({ received: true });
    } catch (reason) { return apiFailure(reason); }
  });
}
