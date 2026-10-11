// Only explicitly authored messages may be rendered to users. SDK, network,
// parser, and database exceptions fall back to the operation's recovery copy.
export class UserFacingError extends Error {
  constructor(message: string, public code?: string | number) { super(message); }
}

export function userErrorMessage(reason: unknown, fallback: string) {
  if (reason instanceof UserFacingError) return reason.message;
  const code = reason && typeof reason === 'object' && 'code' in reason ? reason.code : undefined;
  const message = reason instanceof Error ? reason.message : '';
  if (code === 4001 || code === '4001' || code === 'USER_CANCELLED' || /user rejected|user denied|cancelled|canceled|popup closed/i.test(message)) return 'Wallet approval was cancelled. Try again when you are ready.';
  if (code === 4100 || code === '4100') return 'Reconnect your selected wallet and approve access before trying again.';
  return fallback;
}

export function responseError(response: Pick<Response, 'status'>, result: { error?: unknown; code?: unknown }, fallback: string) {
  const message = response.status >= 400 && response.status < 500 && typeof result.error === 'string' ? result.error : fallback;
  return new UserFacingError(message, typeof result.code === 'string' || typeof result.code === 'number' ? result.code : undefined);
}
