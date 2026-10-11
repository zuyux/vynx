import { logServerRequest } from '@/lib/server-log';
import { limitPublicEndpoint } from '@/lib/public-rate-limit';
import { assertRegistryOwnership } from '@/lib/alias-registration';
import { NextResponse } from 'next/server';
import { appDb } from '@/lib/app-db';
import { apiFailure, ApiError, assertOrigin, cookieOptions, NONCE_COOKIE, readSession, requestCookie, SESSION_COOKIE, sessionHash, verifySignIn } from '@/lib/wallet-session';

export async function GET(request: Request) {
  return logServerRequest(request, '/api/auth/session', async () => {
    try {
      const wallet = await readSession(requestCookie(request, SESSION_COOKIE));
      let alias = null;
      if (wallet) {
        const { data, error } = await appDb().from('cards_users').select('username').eq('wallet_address', wallet).maybeSingle();
        if (error) throw new ApiError('Unable to load your alias.', 503);
        alias = data?.username ?? null;
        // Legacy reservations remain visible for migration, but cannot authorize edits.
        if (alias) { try { await assertRegistryOwnership(wallet, alias); } catch (reason) { if (!(reason instanceof ApiError) || reason.code !== 'REGISTRY_MIGRATION_REQUIRED') throw reason; } }
      }
      return NextResponse.json({ wallet, alias }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (reason) { return apiFailure(reason); }
  });
}
export async function POST(request: Request) {
  return logServerRequest(request, '/api/auth/session', async () => {
    const limited = await limitPublicEndpoint(request, 'auth');
    if (limited) return limited;
    try {
      assertOrigin(request);
      const body = await request.json();
      if (!body.id || body.id !== requestCookie(request, NONCE_COOKIE)) throw new ApiError('Sign-in challenge does not belong to this browser.', 401);
      const token = await verifySignIn(body.id, body.wallet, body.signature);
      const oldToken = requestCookie(request, SESSION_COOKIE);
      if (oldToken) {
        const { error } = await appDb().from('wallet_sessions').delete().eq('token_hash', sessionHash(oldToken));
        if (error) throw new ApiError('Unable to replace session.', 503);
      }
      const response = NextResponse.json({ wallet: body.wallet }, { headers: { 'Cache-Control': 'no-store' } });
      response.cookies.set(SESSION_COOKIE, token, cookieOptions());
      response.cookies.set(NONCE_COOKIE, '', cookieOptions(0));
      return response;
    } catch (reason) { return apiFailure(reason); }
  });
}
export async function DELETE(request: Request) {
  return logServerRequest(request, '/api/auth/session', async () => {
    const limited = await limitPublicEndpoint(request, 'mutation');
    if (limited) return limited;
    try {
      assertOrigin(request);
      const token = requestCookie(request, SESSION_COOKIE);
      if (token) {
        const { error } = await appDb().from('wallet_sessions').delete().eq('token_hash', sessionHash(token));
        if (error) throw new ApiError('Unable to revoke session. Please retry.', 503);
      }
      const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
      response.cookies.set(SESSION_COOKIE, '', cookieOptions(0));
      response.cookies.set(NONCE_COOKIE, '', cookieOptions(0));
      return response;
    } catch (reason) { return apiFailure(reason); }
  });
}
