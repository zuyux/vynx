import { logServerRequest } from '@/lib/server-log';
import { limitPublicEndpoint } from '@/lib/public-rate-limit';
import { createHash } from 'node:crypto';
import { appDb } from '@/lib/app-db';
import { aliasAvailabilityClientHash } from '@/lib/alias-availability';
import { NextRequest, NextResponse } from 'next/server';
import { ALIAS_BLOCKCHAIN_ID, CLAIM_PRICE_SOL } from '@/lib/alias-network';
import { buildClaim } from '@/lib/alias-claim';
import { normalizeAlias } from '@/lib/alias';
import { registryEnabled } from '@/lib/alias-registry';
import { registrationQuote } from '@/lib/alias-registration';
import { ApiError, apiFailure, assertOrigin, requireWallet } from '@/lib/wallet-session';

export const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'X-Action-Version': '2.1.3', 'X-Blockchain-Ids': ALIAS_BLOCKCHAIN_ID, 'Cache-Control': 'no-store' };
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }
export async function GET(request: NextRequest) {
  return logServerRequest(request, '/api/actions/claim-alias', async () => {
    try {
      if (registryEnabled()) {
        const client = createHash('sha256').update(`pricing:${aliasAvailabilityClientHash(request, process.env.SUPABASE_SECRET_KEY ?? '')}`).digest('hex');
        const { data, error } = await appDb().rpc('consume_alias_availability_limit', { client_hash: client });
        if (error || typeof data?.allowed !== 'boolean') throw new ApiError('Pricing is temporarily unavailable.', 503);
        if (!data.allowed) return NextResponse.json({ error: 'Too many pricing requests. Please try again shortly.' }, { status: 429, headers: { ...CORS, 'Retry-After': String(data.retry_after) } });
      }
      const alias = normalizeAlias(request.nextUrl.searchParams.get('alias'));
      const quote = registryEnabled() ? await registrationQuote(alias) : { priceSol: CLAIM_PRICE_SOL, priceLamports: '10000', priceVersion: '0', sponsored: false };
      const origin = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
      return NextResponse.json({ priceSol: quote.priceSol, priceLamports: quote.priceLamports, priceVersion: quote.priceVersion, sponsored: quote.sponsored, title: `Claim @${alias} on VYNX`, icon: `${origin}/logo.png`, description: `Pay ${quote.priceSol} devnet SOL to register your alias.`, label: `Claim @${alias}`, links: { actions: [{ label: `Claim for ${quote.priceSol} SOL`, href: `/api/actions/claim-alias?alias=${alias}` }] } }, { headers: CORS });
    } catch (reason) { return apiFailure(reason, CORS); }
  }, CORS);
}
export async function POST(request: NextRequest) {
  return logServerRequest(request, '/api/actions/claim-alias', async () => {
    const limited = await limitPublicEndpoint(request, 'payment', CORS);
    if (limited) return limited;
    try {
      const body = await request.json();
      if (registryEnabled()) {
        assertOrigin(request);
        if (await requireWallet(request) !== body.account) throw new ApiError('Use your signed-in wallet.', 403);
      }
      const result = await buildClaim(request.nextUrl.searchParams.get('alias'), body.account, body);
      const priceSol = 'priceSol' in result ? result.priceSol : CLAIM_PRICE_SOL;
      return NextResponse.json({ ...result, message: `Claim @${result.alias} for ${priceSol} devnet SOL`, links: { next: { type: 'post', href: `/api/actions/claim-alias/confirm?alias=${result.alias}` } } }, { headers: CORS });
    } catch (reason) { return apiFailure(reason, CORS); }
  }, CORS);
}
