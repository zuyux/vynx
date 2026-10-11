import { appDb } from '@/lib/app-db';
import { apiFailure, ApiError, assertOrigin, requireWallet } from '@/lib/wallet-session';
import { assertRegistryOwnership } from '@/lib/alias-registration';
import { limitPublicEndpoint } from '@/lib/public-rate-limit';
import { logServerRequest } from '@/lib/server-log';
import { CALL_OFFER_COLUMNS, callOfferFields, callOfferResponse } from '@/lib/call-offer';

const reply = (body: unknown) => Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
async function creator(request: Request) {
  const wallet = await requireWallet(request);
  const { data, error } = await appDb().from('cards_users').select('username').eq('wallet_address', wallet).maybeSingle();
  if (error) throw new ApiError("Could not verify your profile. Try again.", 503);
  if (!data) throw new ApiError("Buy your alias before setting up a video call.", 409);
  await assertRegistryOwnership(wallet, data.username);
  return wallet;
}
async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("Complete the service details.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 16_384) { await reader.cancel(); throw new ApiError("The service data is too large.", 413); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { reader.releaseLock(); }
}
export async function GET(request: Request) {
  return logServerRequest(request, '/api/call-offer', async () => {
    try {
      const wallet = await creator(request);
      const { data, error } = await appDb().from('call_offers').select(CALL_OFFER_COLUMNS).eq('creator_wallet', wallet).maybeSingle();
      if (error) throw new ApiError("Could not load your service. Try again.", 503);
      return reply({ offer: data ? callOfferResponse(data) : null });
    } catch (reason) { return apiFailure(reason); }
  });
}
export async function PUT(request: Request) {
  return logServerRequest(request, '/api/call-offer', async () => {
    const limited = await limitPublicEndpoint(request, 'mutation'); if (limited) return limited;
    try {
      assertOrigin(request);
      const wallet = await creator(request);
      const fields = callOfferFields(await readBody(request));
      const { data, error } = await appDb().from('call_offers').upsert({ ...fields, creator_wallet: wallet }, { onConflict: 'creator_wallet' }).select(CALL_OFFER_COLUMNS).single();
      if (error) throw new ApiError("Could not save your service. Your draft is preserved; try again.", 503);
      return reply({ offer: callOfferResponse(data) });
    } catch (reason) { return apiFailure(reason); }
  });
}
