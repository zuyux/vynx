import { appDb } from '@/lib/app-db';
import { boundedJSON } from '@/lib/daily-video';
import { reviewInput } from '@/lib/call-review';
import { apiFailure, ApiError, assertOrigin, requireWallet } from '@/lib/wallet-session';
import { limitPublicEndpoint } from '@/lib/public-rate-limit';
import { logServerRequest } from '@/lib/server-log';

const validId = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);
const reply = (body: unknown) => Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
export async function GET(request: Request) {
  return logServerRequest(request, '/api/call-reviews', async () => {
    try {
      const wallet = await requireWallet(request), id = new URL(request.url).searchParams.get('id');
      if (!validId(id)) throw new ApiError('Invalid booking.');
      const db = appDb();
      const { data: booking, error } = await db.from('call_bookings').select('payer_wallet,state,payment_signature,monthly_invoice_id,ends_at').eq('id', id).maybeSingle();
      if (error) throw new ApiError('Reviews are unavailable.', 503);
      if (!booking || booking.payer_wallet !== wallet) throw new ApiError('Booking not found.', 404);
      const { data: review, error: reviewError } = await db.from('call_reviews').select('overall_rating,punctuality,communication,fulfillment,comment,created_at').eq('booking_id', id).maybeSingle();
      if (reviewError) throw new ApiError('Reviews are unavailable.', 503);
      return reply({ review, eligible: !review && booking.state === 'completed' && (!!booking.payment_signature || !!booking.monthly_invoice_id) && Date.parse(booking.ends_at) <= Date.now() });
    } catch (reason) { return apiFailure(reason); }
  });
}
export async function POST(request: Request) {
  return logServerRequest(request, '/api/call-reviews', async () => {
    const limited = await limitPublicEndpoint(request, 'mutation'); if (limited) return limited;
    try {
      assertOrigin(request);
      const wallet = await requireWallet(request), body = await boundedJSON(request, 16_384);
      const review = reviewInput(body);
      if (!validId(body.id) || !review || Object.keys(body).some(key => !['id','overall_rating','punctuality','communication','fulfillment','comment'].includes(key))) throw new ApiError('Provide a comment and all four ratings from 1 to 5.');
      const { data, error } = await appDb().rpc('submit_call_review', { booking: body.id, actor: wallet, overall: review.overall_rating,
        punctuality_score: review.punctuality, communication_score: review.communication, fulfillment_score: review.fulfillment, review_comment: review.comment });
      if (error) throw new ApiError(error.code === 'P0002' ? 'Booking not found.' : error.code === '23505' ? 'You already reviewed this booking.' : error.code === 'P0001' ? 'Only paid completed bookings can be reviewed.' : 'Could not save the review. Retry with the same feedback.',
        error.code === 'P0002' ? 404 : ['P0001','23505'].includes(error.code) ? 409 : 503);
      return reply({ review: { overall_rating: data.overall_rating, punctuality: data.punctuality, communication: data.communication,
        fulfillment: data.fulfillment, comment: data.comment, created_at: data.created_at } });
    } catch (reason) { return apiFailure(reason); }
  });
}
