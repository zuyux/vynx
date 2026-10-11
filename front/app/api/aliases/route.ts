import { logServerRequest } from '@/lib/server-log';
import { aliasAvailability } from '@/lib/alias-availability';
import { appDb } from '@/lib/app-db';
import { apiFailure } from '@/lib/wallet-session';

export async function GET(request: Request) {
  return logServerRequest(request, '/api/aliases', async () => {
    try {
      return await aliasAvailability(request, appDb(), process.env.SUPABASE_SECRET_KEY!);
    } catch (reason) { return apiFailure(reason); }
  });
}
