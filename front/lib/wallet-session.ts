import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { appDb } from '@/lib/app-db';
import { validWalletSignature, walletKey } from '@/lib/sponsorship-server';
import { UserFacingError } from './user-facing-error';

export const SESSION_COOKIE = 'vynx-session';
export const NONCE_COOKIE = 'vynx-nonce';
export const SESSION_SECONDS = 60 * 60 * 24;
export const sessionHash = (token: string) => createHash('sha256').update(token).digest('hex');

export class ApiError extends Error {
  constructor(message: string, public status = 400, public code?: string) { super(message); }
}
export function assertOrigin(request: Request) {
  const expected = new URL(process.env.NEXT_PUBLIC_APP_URL ?? request.url).origin;
  if (request.headers.get('origin') !== expected) throw new ApiError('Untrusted request origin.', 403);
}
export function requestCookie(request: Request, name: string) {
  return request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? '';
}
export function cookieOptions(maxAge = SESSION_SECONDS) {
  const origin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost');
  if (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) {
    throw new ApiError('Production sessions require HTTPS.', 503);
  }
  return { httpOnly: true, secure: origin.protocol === 'https:', sameSite: 'lax' as const, path: '/', maxAge };
}
export async function readSession(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { data, error } = await appDb().from('wallet_sessions').select('wallet,expires_at')
    .eq('token_hash', sessionHash(token)).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (error) throw new ApiError('Sign-in is temporarily unavailable. Please try again.', 503);
  return data?.wallet as string | undefined ?? null;
}
export async function requireWallet(request: Request) {
  const wallet = await readSession(requestCookie(request, SESSION_COOKIE));
  if (!wallet) throw new ApiError('Sign in with your wallet to continue.', 401);
  return wallet;
}
export async function issueNonce(wallet: string, origin: string) {
  walletKey(wallet);
  const db = appDb();
  const { count, error: rateError } = await db.from('wallet_nonces').select('id', { count: 'exact', head: true })
    .eq('wallet', wallet).gte('created_at', new Date(Date.now() - 60_000).toISOString());
  if (rateError) throw new ApiError('Sign-in is temporarily unavailable. Please try again.', 503);
  if ((count ?? 0) >= 10) throw new ApiError('Wait a minute before trying to sign in again.', 429);
  const id = randomUUID();
  const expires = new Date(Date.now() + 5 * 60_000).toISOString();
  const message = `${origin} requests a VYNX sign-in.\nWallet: ${wallet}\nNonce: ${id}\nExpires: ${expires}\nThis signature creates a 24-hour application session and does not transfer funds.`;
  const { error } = await db.from('wallet_nonces').insert({ id, wallet, message, expires_at: expires });
  if (error) throw new ApiError('Unable to prepare sign-in.', 503);
  return { id, message };
}
export async function verifySignIn(id: string, wallet: string, signature: string) {
  const key = walletKey(wallet);
  const db = appDb();
  const { data, error } = await db.from('wallet_nonces').select('*').eq('id', id).eq('wallet', wallet)
    .gt('expires_at', new Date().toISOString()).maybeSingle();
  if (error || !data) throw new ApiError('Sign-in expired or was already used. Please retry.', 401);
  if (typeof signature !== 'string' || !validWalletSignature(key, data.message, signature)) throw new ApiError('Wallet signature is invalid. Reconnect your wallet and approve a new sign-in message.', 401, 'SIGNATURE_REJECTED');
  const { data: used, error: consumeError } = await db.from('wallet_nonces').delete().eq('id', id).gt('expires_at', new Date().toISOString()).select('id');
  if (consumeError || used?.length !== 1) throw new ApiError('Sign-in was already used.', 401);
  const token = randomBytes(32).toString('hex');
  const { error: sessionError } = await db.from('wallet_sessions').insert({ token_hash: sessionHash(token), wallet, expires_at: new Date(Date.now() + SESSION_SECONDS * 1000).toISOString() });
  if (sessionError) throw new ApiError('Unable to create session.', 503);
  return token;
}
export function apiFailure(reason: unknown, headers: HeadersInit = {}) {
  const expected = reason instanceof ApiError || reason instanceof UserFacingError;
  const status = reason instanceof ApiError ? reason.status : expected || reason instanceof SyntaxError ? 400 : 500;
  const message = expected && status < 500 ? reason.message : status === 400 ? 'Invalid request. Please check your details.' : 'Something went wrong. Please try again shortly.';
  return Response.json({ error: message, ...(expected && reason.code ? { code: reason.code } : {}) }, {
    status, headers: { ...Object.fromEntries(new Headers(headers)), 'Cache-Control': 'no-store' },
  });
}
