import { UserFacingError } from './user-facing-error';
const RESERVED = new Set(['admin', 'api', 'auth', 'creators', 'dashboard', 'profile', 'support', 'settings', 'login', 'logout', 'favicon', 'robots', 'sitemap', '_next', 'help', 'security', 'treasury', 'official', 'vynx', 'system']);

export function normalizeAlias(value: unknown) {
  if (typeof value !== 'string') throw new UserFacingError('Enter a valid alias.');
  const alias = value.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9_]{1,30}$/.test(alias) || RESERVED.has(alias)) {
    throw new UserFacingError('Use 1–30 letters, numbers or underscores, and choose an available creator name.');
  }
  return alias;
}

export function safeDestination(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') && !/[\u0000-\u0020\\]/.test(value) ? value : '/dashboard';
}
