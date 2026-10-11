import { logServerRequest } from '@/lib/server-log';
import { limitPublicEndpoint } from '@/lib/public-rate-limit';
import { NextResponse } from 'next/server';
import { apiFailure, assertOrigin, cookieOptions, issueNonce, NONCE_COOKIE } from '@/lib/wallet-session';

export async function POST(request: Request) {
  return logServerRequest(request, '/api/auth/nonce', async () => {
    const limited = await limitPublicEndpoint(request, 'auth');
    if (limited) return limited;
    try {
      assertOrigin(request);
      const { wallet } = await request.json();
      const challenge = await issueNonce(wallet, new URL(process.env.NEXT_PUBLIC_APP_URL ?? request.url).origin);
      const response = NextResponse.json(challenge, { headers: { 'Cache-Control': 'no-store' } });
      response.cookies.set(NONCE_COOKIE, challenge.id, cookieOptions(300));
      return response;
    } catch (reason) { return apiFailure(reason); }
  });
}
