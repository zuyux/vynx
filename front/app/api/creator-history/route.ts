import { publicCreator } from '@/lib/public-creator';
import { creatorCallHistory } from '@/lib/creator-call-history';
import { apiFailure, ApiError } from '@/lib/wallet-session';
import { limitPublicEndpoint } from '@/lib/public-rate-limit';
import { logServerRequest } from '@/lib/server-log';

export async function GET(request: Request) {
  return logServerRequest(request, '/api/creator-history', async () => {
    const limited = await limitPublicEndpoint(request, 'mutation'); if (limited) return limited;
    try {
      const query = new URL(request.url).searchParams, offset = query.get('offset') ?? '0';
      if (!/^\d{1,9}$/.test(offset)) throw new ApiError('Invalid review page.');
      const creator = await publicCreator(query.get('alias') ?? '');
      if (!creator) throw new ApiError('Creator not found.', 404);
      return Response.json(await creatorCallHistory(creator.wallet, Number(offset)), { headers: { 'Cache-Control': 'no-store' } });
    } catch (reason) { return apiFailure(reason); }
  });
}
