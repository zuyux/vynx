import { appDb } from '@/lib/app-db';
import { apiFailure, ApiError, requireWallet } from '@/lib/wallet-session';

export async function GET(request: Request) {
  try {
    const wallet = await requireWallet(request);
    const db = appDb();
    const { data: profile, error } = await db.from('cards_users').select('id,username,display_name,published').eq('wallet_address', wallet).maybeSingle();
    if (error) throw new ApiError('Unable to load your profile.', 503);
    if (!profile) throw new ApiError('Claim your alias to open the dashboard.', 409);
    const [summary, recent] = await Promise.all([
      db.rpc('creator_tip_summary', { owner_wallet: wallet }),
      db.from('tips').select('id,lamports,currency,token_amount,signature,created_at').eq('creator_id', profile.id).order('created_at', { ascending: false }).limit(10),
    ]);
    if (summary.error || recent.error) throw new ApiError('Unable to load your tips right now. Please retry.', 503);
    return Response.json({ profile, tips: { ...summary.data, recent: recent.data } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (reason) { return apiFailure(reason); }
}
