import { UserFacingError, responseError } from './user-facing-error';

export async function walletOnboardingDestination(wallet: string, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(15_000);
  const response = await fetch('/api/auth/session', { cache: 'no-store', signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  const session = await response.json();
  if (!response.ok) throw responseError(response, session, 'Unable to check your alias. Please retry.');
  if (session.wallet !== wallet) throw new UserFacingError('Your sign-in changed. Sign in with the current wallet again.');
  if (session.alias === null) return '/profile/buy-alias?welcome=1&next=%2Fdashboard%2Fcard';
  if (typeof session.alias === 'string' && /^[a-z0-9_]{1,30}$/.test(session.alias)) return null;
  throw new UserFacingError('Unable to check your alias. Please retry.');
}
