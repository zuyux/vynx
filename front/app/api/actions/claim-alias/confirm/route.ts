import { logServerRequest, monitorPaymentVerification } from '@/lib/server-log';
import { limitPublicEndpoint } from '@/lib/public-rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { confirmClaim } from '@/lib/alias-claim';
import { ALIAS_BLOCKCHAIN_ID } from '@/lib/alias-network';
import { registryEnabled } from '@/lib/alias-registry';
import { ApiError, apiFailure, assertOrigin, requireWallet } from '@/lib/wallet-session';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'X-Action-Version': '2.1.3', 'X-Blockchain-Ids': ALIAS_BLOCKCHAIN_ID, 'Cache-Control': 'no-store' };
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }
export async function POST(request: NextRequest) {
  return logServerRequest(request, '/api/actions/claim-alias/confirm', async () => {
    const limited = await limitPublicEndpoint(request, 'payment', CORS);
    if (limited) return limited;
    try {
      const body = await request.json();
      if (registryEnabled()) {
        assertOrigin(request);
        if (await requireWallet(request) !== body.account) throw new ApiError('Use your signed-in wallet.', 403);
      }
      const result = await monitorPaymentVerification('alias_claim', () => confirmClaim(request.nextUrl.searchParams.get('alias'), body.account, body.signature));
      return NextResponse.json({ ...result, type: 'completed', title: `@${result.alias} is yours!`, icon: `${process.env.NEXT_PUBLIC_APP_URL}/logo.png`, description: 'Your alias is registered. Customize and publish your creator card.', label: 'Done' }, { headers: CORS });
    } catch (reason) { return apiFailure(reason, CORS); }
  }, CORS);
}
