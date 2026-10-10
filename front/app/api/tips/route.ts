import { buildTip } from '@/lib/tip-server';
import { normalizeAlias } from '@/lib/alias';
import { apiFailure, assertOrigin, requireWallet } from '@/lib/wallet-session';

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const wallet = await requireWallet(request);
    const body = await request.json();
    return Response.json(await buildTip(normalizeAlias(body.alias), wallet, body.amount, body.currency), { headers: { 'Cache-Control': 'no-store' } });
  } catch (reason) { return apiFailure(reason); }
}
