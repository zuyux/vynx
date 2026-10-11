import { logServerRequest } from '@/lib/server-log';
import { appDb } from '@/lib/app-db';
import { apiFailure, ApiError, requireWallet } from '@/lib/wallet-session';
import { registryConnection } from '@/lib/alias-registration';
import { registryEnabled } from '@/lib/alias-registry';
import { claimRpc } from '@/lib/claim-rpc';

// Recover a broadcast registration after local storage or profile indexing fails.
// Unbroadcast reservations do not put the browser into verification-only mode.
export async function GET(request: Request) {
  return logServerRequest(request, '/api/actions/claim-alias/pending', async () => {
    try {
      const wallet = await requireWallet(request);
      if (!registryEnabled()) return Response.json({ pending: null }, { headers: { 'Cache-Control': 'no-store' } });
      const { data, error } = await appDb().from('alias_registration_intents').select('alias,signature').eq('wallet', wallet).in('state', ['prepared', 'confirmed']).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw new ApiError('Registration recovery is unavailable.', 503);
      let pending = null;
      if (data) {
        const connection = await registryConnection();
        const status = await claimRpc(() => connection.getSignatureStatuses([data.signature], { searchTransactionHistory: true }));
        if (status.value[0] && !status.value[0].err) pending = data;
      }
      return Response.json({ pending }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (reason) { return apiFailure(reason); }
  });
}
