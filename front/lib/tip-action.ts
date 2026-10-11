import { ALIAS_BLOCKCHAIN_ID } from './alias-network';
import { normalizeAlias } from './alias';
import { tipLamports } from './sol-payment';
import { apiFailure, ApiError } from './wallet-session';

export const TIP_ACTION_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Content-Encoding, Accept-Encoding',
  'Access-Control-Expose-Headers': 'X-Action-Version, X-Blockchain-Ids',
  'X-Action-Version': '2.1.3',
  'X-Blockchain-Ids': ALIAS_BLOCKCHAIN_ID,
  'Cache-Control': 'no-store',
};

export function tipActionParameters(request: Request, aliasValue: string) {
  const alias = normalizeAlias(aliasValue);
  const params = new URL(request.url).searchParams;
  if (params.has('currency') && params.get('currency') !== 'SOL') throw new ApiError('Public tip Actions support devnet SOL. Use the creator page for USDC.');
  const amount = params.get('amount') ?? '0.01';
  tipLamports(amount);
  return { alias, amount, href: `/api/actions/tip/${alias}` };
}

export function tipActionIcon(request: Request) {
  return new URL('/android-chrome-512x512.png', process.env.NEXT_PUBLIC_APP_URL ?? request.url).href;
}

// Preserve the shared error sanitization while using the Actions error schema.
export async function tipActionFailure(reason: unknown) {
  const response = apiFailure(reason, TIP_ACTION_HEADERS);
  response.headers.set('Cache-Control', 'no-store');
  const { error, code } = await response.json();
  return Response.json({ message: error, ...(code ? { code } : {}) }, {
    status: response.status, headers: response.headers,
  });
}
