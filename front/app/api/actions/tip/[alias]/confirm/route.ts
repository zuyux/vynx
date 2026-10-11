import { logServerRequest, monitorPaymentVerification } from '@/lib/server-log';
import { limitPublicEndpoint } from '@/lib/public-rate-limit';
import { confirmTip } from '@/lib/tip-server';
import { walletKey } from '@/lib/sponsorship-server';
import { TIP_ACTION_HEADERS, tipActionFailure, tipActionIcon, tipActionParameters } from '@/lib/tip-action';
import { ApiError } from '@/lib/wallet-session';

type Context = { params: Promise<{ alias: string }> };
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: TIP_ACTION_HEADERS });
}
export async function POST(request: Request, context: Context) {
  return logServerRequest(request, '/api/actions/tip/[alias]/confirm', async () => {
    const limited = await limitPublicEndpoint(request, 'payment', TIP_ACTION_HEADERS);
    if (limited) return limited;
    try {
      const { alias, amount } = tipActionParameters(request, (await context.params).alias);
      const body = await request.json();
      if (!body || typeof body.account !== 'string') throw new ApiError('A Solana wallet account is required.');
      walletKey(body.account);
      await monitorPaymentVerification('tip', () => confirmTip(alias, body.account, amount, body.signature, 'SOL'));
      return Response.json({
        type: 'completed', title: `Thanks for supporting @${alias}!`,
        icon: tipActionIcon(request), description: `Your ${amount} devnet SOL tip is verified.`, label: 'Tip confirmed',
      }, { headers: TIP_ACTION_HEADERS });
    } catch (reason) { return tipActionFailure(reason); }
  }, TIP_ACTION_HEADERS);
}
