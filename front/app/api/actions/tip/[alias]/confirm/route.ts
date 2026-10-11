import { logServerRequest, monitorPaymentVerification } from '@/lib/server-log';
import { limitPublicEndpoint } from '@/lib/public-rate-limit';
import { confirmTip } from '@/lib/tip-server';
import { walletKey } from '@/lib/sponsorship-server';
import { TIP_ACTION_HEADERS, tipActionFailure, tipActionIcon, tipActionParameters } from '@/lib/tip-action';
import { normalizeAlias } from '@/lib/alias';
import { tipLamports } from '@/lib/sol-payment';
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
      const aliasValue = (await context.params).alias;
      const params = new URL(request.url).searchParams;
      // Existing SOL Action callbacks omitted currency. They remain verifiable.
      const legacy = !params.has('currency') || params.get('currency') === 'SOL';
      const { alias, amount } = legacy ? { alias: normalizeAlias(aliasValue), amount: params.get('amount') ?? '0.01' } : tipActionParameters(request, aliasValue);
      if (legacy) tipLamports(amount);
      const currency = legacy ? 'SOL' : 'USDC';
      const body = await request.json();
      if (!body || typeof body.account !== 'string') throw new ApiError('A Solana wallet account is required.');
      walletKey(body.account);
      await monitorPaymentVerification('tip', () => confirmTip(alias, body.account, amount, body.signature, currency));
      return Response.json({
        type: 'completed', title: `Thanks for supporting @${alias}!`,
        icon: tipActionIcon(request), description: `Your ${amount} devnet ${currency} tip is verified.`, label: 'Tip confirmed',
      }, { headers: TIP_ACTION_HEADERS });
    } catch (reason) { return tipActionFailure(reason); }
  }, TIP_ACTION_HEADERS);
}
