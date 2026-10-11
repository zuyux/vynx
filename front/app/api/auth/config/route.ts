import { logServerRequest } from '@/lib/server-log';

// Public identifier only. The app secret is never included in this response.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return logServerRequest(request, '/api/auth/config', async () => Response.json({ privyAppId: process.env.PRIVY_APP_ID?.trim() || null }, {
    headers: { 'Cache-Control': 'no-store' },
  }));
}
