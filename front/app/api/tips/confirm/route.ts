import { logServerRequest, monitorPaymentVerification } from '@/lib/server-log';
import { limitPublicEndpoint } from '@/lib/public-rate-limit';
import { confirmTip } from '@/lib/tip-server';
import { normalizeAlias } from '@/lib/alias';
import { apiFailure, assertOrigin, requireWallet } from '@/lib/wallet-session';

export async function POST(request: Request) {
  return logServerRequest(request, '/api/tips/confirm', async () => {
    const limited = await limitPublicEndpoint(request, 'payment');
    if (limited) return limited;
    try {
      assertOrigin(request);
      const wallet = await requireWallet(request);
      const body = await request.json();
      return Response.json(await monitorPaymentVerification('tip', () => confirmTip(normalizeAlias(body.alias), wallet, body.amount, body.signature, body.currency)), { headers: { 'Cache-Control': 'no-store' } });
    } catch (reason) { return apiFailure(reason); }
  });
}
