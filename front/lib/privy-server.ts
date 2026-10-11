import { PrivyClient } from '@privy-io/node';
import { ApiError } from './wallet-session';
import { walletKey } from './sponsorship-server';

export async function verifyPrivyWallet(accessToken: unknown, wallet: unknown) {
  const appId = process.env.PRIVY_APP_ID?.trim();
  const appSecret = process.env.PRIVY_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new ApiError('Privy sign-in is not configured.', 503);
  if (typeof accessToken !== 'string' || !accessToken || accessToken.length > 12_000 || typeof wallet !== 'string') throw new ApiError('Invalid sign-in.', 401);
  walletKey(wallet);
  const client = new PrivyClient({ appId, appSecret, timeout: 10_000, maxRetries: 1 });
  let claims;
  try { claims = await client.utils().auth().verifyAccessToken(accessToken); }
  catch { throw new ApiError('Privy sign-in expired or is invalid. Sign in again.', 401); }
  const seconds = Math.min(3600, Math.floor(claims.expiration - Date.now() / 1000));
  if (seconds <= 0) throw new ApiError('Privy sign-in expired.', 401);
  let user;
  try { user = await client.users()._get(claims.user_id); }
  catch { throw new ApiError('Unable to verify your Privy wallet. Try again.', 503); }
  if (user.id !== claims.user_id || !user.linked_accounts.some(account => account.type === 'wallet'
    && account.chain_type === 'solana' && account.address === wallet && account.verified_at != null)) {
    throw new ApiError('This Solana wallet does not belong to your authenticated account.', 403);
  }
  return { wallet, seconds };
}
