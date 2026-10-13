import { appDb } from '@/lib/app-db';
import { boundedJSON } from '@/lib/daily-video';
import { notificationEmail, notificationEmailSettings } from '@/lib/notification-email';
import { apiFailure, ApiError, assertOrigin, requireWallet } from '@/lib/wallet-session';
import { limitPublicEndpoint } from '@/lib/public-rate-limit';
import { logServerRequest } from '@/lib/server-log';

const reply = (row: Parameters<typeof notificationEmailSettings>[0]) => Response.json({ settings: notificationEmailSettings(row) }, { headers: { 'Cache-Control': 'no-store' } });
export async function GET(request: Request) {
  return logServerRequest(request, '/api/notification-email', async () => {
    try {
      const wallet = await requireWallet(request);
      const { data, error } = await appDb().from('account_notification_settings').select('privy_email,notification_email').eq('wallet', wallet).maybeSingle();
      if (error) throw new ApiError('Could not load your notification email.', 503);
      return reply(data);
    } catch (reason) { return apiFailure(reason); }
  });
}
export async function PUT(request: Request) {
  return logServerRequest(request, '/api/notification-email', async () => {
    const limited = await limitPublicEndpoint(request, 'mutation'); if (limited) return limited;
    try {
      assertOrigin(request);
      const wallet = await requireWallet(request), body = await boundedJSON(request, 2048);
      if (body.wallet !== wallet) throw new ApiError('Your account changed. Reload before saving the email.', 409);
      if (Object.keys(body).some(key => !['wallet', 'email'].includes(key)) || !Object.hasOwn(body, 'email')) throw new ApiError('Provide a notification email address.');
      const email = notificationEmail(body.email);
      const { data, error } = await appDb().rpc('save_notification_email', { owner_wallet: wallet, email });
      if (error) throw new ApiError(error.code === '22023' ? 'Your Privy account already provides a notification email. Manage that email through Privy.' : 'Could not save your notification email. Retry.', error.code === '22023' ? 409 : 503);
      return reply(data);
    } catch (reason) { return apiFailure(reason); }
  });
}
