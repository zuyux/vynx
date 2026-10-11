import { logServerRequest } from '@/lib/server-log';
import { limitPublicEndpoint } from '@/lib/public-rate-limit';
import { publicCreator } from '@/lib/public-creator';
import { buildTip } from '@/lib/tip-server';
import { TIP_ACTION_HEADERS, tipActionFailure, tipActionIcon, tipActionParameters } from '@/lib/tip-action';
import { ApiError } from '@/lib/wallet-session';

type Context = { params: Promise<{ alias: string }> };
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: TIP_ACTION_HEADERS });
}
export async function GET(request: Request, context: Context) {
  return logServerRequest(request, '/api/actions/tip/[alias]', async () => {
    try {
      const { alias, amount, href } = tipActionParameters(request, (await context.params).alias);
      const creator = await publicCreator(alias);
      if (!creator) throw new ApiError('Creator not found.', 404);
      return Response.json({
        type: 'action', title: `Tip @${alias} on VYNX`, icon: tipActionIcon(request),
        description: `Support ${creator.design.name || `@${alias}`} with devnet USDC. These are test tokens; network fees are sponsored.`,
        label: `Tip ${amount} USDC`, disabled: !creator.tipsEnabled,
        ...(!creator.tipsEnabled ? { error: { message: 'This creator is not receiving tips.' } } : {
          links: { actions: [
            ...['1', '5', '10'].map(value => ({ type: 'transaction', label: `Tip ${value} USDC`, href: `${href}?amount=${value}` })),
            { type: 'transaction', label: 'Tip USDC', href: `${href}?amount={amount}`, parameters: [{ name: 'amount', label: 'USDC amount (0.01–1,000)', required: true, type: 'number', min: 0.01, max: 1000 }] },
          ] },
        }),
      }, { headers: TIP_ACTION_HEADERS });
    } catch (reason) { return tipActionFailure(reason); }
  }, TIP_ACTION_HEADERS);
}
export async function POST(request: Request, context: Context) {
  return logServerRequest(request, '/api/actions/tip/[alias]', async () => {
    const limited = await limitPublicEndpoint(request, 'payment', TIP_ACTION_HEADERS);
    if (limited) return limited;
    try {
      const { alias, amount, href } = tipActionParameters(request, (await context.params).alias);
      const body = await request.json();
      if (!body || typeof body.account !== 'string') throw new ApiError('A Solana wallet account is required.');
      const result = await buildTip(alias, body.account, amount, 'USDC');
      return Response.json({
        type: 'transaction', transaction: result.transaction,
        message: `Tip @${alias} ${amount} devnet USDC`,
        links: { next: { type: 'post', href: `${href}/confirm?currency=USDC&amount=${encodeURIComponent(amount)}` } },
      }, { headers: TIP_ACTION_HEADERS });
    } catch (reason) { return tipActionFailure(reason); }
  }, TIP_ACTION_HEADERS);
}
