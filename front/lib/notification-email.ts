import { UserFacingError } from './user-facing-error';

export type NotificationEmailSettings = { email: string | null; source: 'privy' | 'manual' | null };
export function notificationEmail(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new UserFacingError('Enter a valid email address.');
  const email = value.trim();
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (email.length > 254 || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..') ||
    !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(email)) {
    throw new UserFacingError('Enter a valid email address.');
  }
  return `${local}@${domain.toLowerCase()}`;
}
export function notificationEmailSettings(row: { privy_email?: string | null; notification_email?: string | null } | null): NotificationEmailSettings {
  if (row?.privy_email) return { email: row.privy_email, source: 'privy' };
  if (row?.notification_email) return { email: row.notification_email, source: 'manual' };
  return { email: null, source: null };
}
