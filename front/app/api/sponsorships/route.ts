import { logServerRequest, monitorPaymentVerification } from '@/lib/server-log';
import { limitPublicEndpoint } from '@/lib/public-rate-limit';
import { authorize, checkout, issueChallenge, sponsorDb, verifyPayment } from '@/lib/sponsorship-server';
import { profileFields, requestFields, text, type SponsorAction, type SponsorPayload, type SponsorRequest } from '@/lib/sponsorship-domain';
import { publicationFields } from '@/lib/creator-draft';
import { assertRegistryOwnership } from '@/lib/alias-registration';
import { registryEnabled } from '@/lib/alias-registry';
import { ApiError, apiFailure, requireWallet } from '@/lib/wallet-session';
import { validateClaimedAlias } from '@/lib/claimed-alias';
import { PUBLIC_AD_COLUMNS, PUBLIC_SPONSOR_COLUMNS, publicSponsorAd, publicSponsorProfile } from '@/lib/public-sponsorship';

export const runtime = 'nodejs';
const ACTIONS: SponsorAction[] = ['save-profile', 'save-design', 'request', 'list', 'approve', 'reject', 'checkout', 'confirm'];
const headers = { 'Cache-Control': 'no-store' };
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers });

export async function GET(request: Request) {
  return logServerRequest(request, '/api/sponsorships', async () => {
    try {
      const alias = new URL(request.url).searchParams.get('alias');
      if (!alias || !/^[a-z0-9_]{1,30}$/.test(alias)) return reply({ error: "Invalid alias." }, 400);
      const db = sponsorDb();
      const { data: profile, error } = await db.from('sponsor_profiles').select(PUBLIC_SPONSOR_COLUMNS).eq('alias', alias).maybeSingle();
      if (error) return reply({ error: "Could not load the page. Try again." }, 503);
      if (!profile) return reply({ error: "This creator has not published their page yet." }, 404);
      await assertRegistryOwnership(profile.wallet, alias);
      const { data: ad, error: adError } = await db.from('sponsor_requests')
        .select(PUBLIC_AD_COLUMNS)
        .eq('creator_wallet', profile.wallet).eq('status', 'active').lte('starts_at', new Date().toISOString())
        .gt('ends_at', new Date().toISOString()).maybeSingle();
      if (adError) return reply({ error: "Could not load the sponsored space." }, 503);
      return reply({ profile: publicSponsorProfile(profile), ad: publicSponsorAd(ad) });
    } catch (reason) { return apiFailure(reason); }
  });
}

export async function POST(request: Request) {
  return logServerRequest(request, '/api/sponsorships', async () => {
    const limited = await limitPublicEndpoint(request, 'sponsorship');
    if (limited) return limited;
    try {
      const origin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? request.url).origin;
      if (request.headers.get('origin') !== origin) return reply({ error: 'Unauthorized origin.' }, 403);
      const raw = await request.text();
      if (raw.length > 3000000) return reply({ error: "Request too large. Reduce the image sizes." }, 413);
      const body = JSON.parse(raw);
      if (!body || !ACTIONS.includes(body.action) || !body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) {
        return reply({ error: "Invalid request." }, 400);
      }
      const action: SponsorAction = body.action;
      if (action === 'checkout' || action === 'confirm') {
        const paymentLimited = await limitPublicEndpoint(request, 'payment');
        if (paymentLimited) return paymentLimited;
      }
      if (action !== 'save-design' && raw.length > 16000) return reply({ error: 'Request too large.' }, 413);
      const sessionWallet = await requireWallet(request);
      if (sessionWallet !== body.wallet) return reply({ error: "The session belongs to another wallet." }, 403);
      const payload: SponsorPayload = body.payload;
      // Validate before issuing or consuming a challenge.
      const design = action === 'save-design' ? publicationFields(payload) : null;
      if (body.phase === 'challenge') return reply(await issueChallenge(origin, body.wallet, action, payload));
      if (typeof body.signature !== 'string' || typeof body.challenge !== 'string') return reply({ error: 'Signature required.' }, 401);
      const db = await authorize(origin, body);
      const wallet: string = body.wallet;

      if (action === 'save-design' && design) {
        await validateClaimedAlias(db, wallet, design.alias);
        const { data: profile, error } = await db.from('sponsor_profiles').update({
          alias: design.alias, display_name: design.name, bio: design.bio, design,
        }).eq('wallet', wallet).select('*').maybeSingle();
        if (error) return reply({ error: error.code === '23505' ? "That alias is already taken." : "Could not publish. Your draft is preserved; try again." }, error.code === '23505' ? 409 : 503);
        if (!profile) return reply({ error: "Publish your offer in Sponsorships first. Then you can publish the design." }, 409);
        return reply({ ok: true, profile });
      }

      if (action === 'save-profile') {
        const fields = profileFields(payload);
        await validateClaimedAlias(db, wallet, fields.alias);
        const { data: profile, error } = await db.from('sponsor_profiles').upsert({ wallet, ...fields }, { onConflict: 'wallet' }).select('*').single();
        if (error) return reply({ error: error.code === '23505' ? "That alias is already taken." : "Could not save the offer." }, 409);
        return reply({ ok: true, profile });
      }
      if (action === 'list') {
        const results = await Promise.all([
          db.from('sponsor_profiles').select('*').eq('wallet', wallet).maybeSingle(),
          db.from('sponsor_requests').select('*').or(`creator_wallet.eq.${wallet},brand_wallet.eq.${wallet}`).order('created_at', { ascending: false }).limit(100),
        ]);
        if (results.some(r => r.error)) return reply({ error: "Could not load your campaigns." }, 503);
        return reply({ profile: results[0].data, campaigns: results[1].data });
      }
      if (action === 'request') {
        const alias = text(payload.alias, 30).toLowerCase();
        const { data: profile, error: lookupError } = await db.from('sponsor_profiles').select('*').eq('alias', alias).single();
        if (lookupError || !profile || !profile.accepting) return reply({ error: "This creator is not accepting requests." }, 409);
        await assertRegistryOwnership(profile.wallet, alias);
        if (profile.wallet === wallet) return reply({ error: "Use a brand wallet different from the creator wallet." }, 400);
        const { count, error: countError } = await db.from('sponsor_requests').select('id', { count: 'exact', head: true }).eq('brand_wallet', wallet).eq('status', 'pending');
        if (countError) return reply({ error: "Could not verify the request." }, 503);
        if ((count ?? 0) >= 10) return reply({ error: 'You already have ten pending requests.' }, 429);
        const fields = requestFields(payload);
        const { error } = await db.from('sponsor_requests').insert({ creator_wallet: profile.wallet, brand_wallet: wallet,
          price_cents: profile.price_cents, duration_days: profile.duration_days, ...fields });
        if (error) return reply({ error: "Could not send the request." }, 409);
        return reply({ ok: true });
      }

      const id = text(payload.id, 36);
      if (!/^[a-f0-9-]{36}$/i.test(id)) return reply({ error: "Invalid campaign." }, 400);
      const { data: campaign, error } = await db.from('sponsor_requests').select('*').eq('id', id).single();
      if (error || !campaign || (campaign.creator_wallet !== wallet && campaign.brand_wallet !== wallet)) return reply({ error: "Campaign not found." }, 404);
      if (registryEnabled()) {
        const { data: creator, error: creatorError } = await db.from('sponsor_profiles').select('alias').eq('wallet', campaign.creator_wallet).maybeSingle();
        if (creatorError) throw new ApiError('Unable to verify campaign ownership.', 503);
        if (!creator) throw new ApiError('Creator profile not found.', 409);
        await assertRegistryOwnership(campaign.creator_wallet, creator.alias);
      }
      if (action === 'approve' || action === 'reject') {
        if (campaign.creator_wallet !== wallet) return reply({ error: "Only the creator can review the ad." }, 403);
        const { error: reviewError } = await db.rpc('review_sponsorship', { request_id: id, reviewer: wallet, decision: action === 'approve' ? 'approved' : 'rejected' });
        if (reviewError) return reply({ error: "The request has already been reviewed or your space is already booked." }, 409);
        return reply({ ok: true });
      }
      if (campaign.brand_wallet !== wallet) return reply({ error: "Only the brand can make this payment." }, 403);
      if (action === 'confirm' && campaign.status === 'active' && campaign.payment_signature === payload.tx_signature) return reply({ ok: true });
      if (campaign.status !== 'approved') return reply({ error: "The creator must approve the campaign before payment." }, 409);
      if (action === 'checkout') return reply(await checkout(campaign as SponsorRequest));
      const signature = text(payload.tx_signature, 88);
      await monitorPaymentVerification('sponsorship', () => verifyPayment(campaign as SponsorRequest, signature));
      const { error: activationError } = await db.rpc('activate_sponsorship', { request_id: id, tx_signature: signature });
      if (activationError) throw new ApiError("The payment could not activate the campaign. Keep the signature and verify it again.", 503);
      return reply({ ok: true });
    } catch (error) { return apiFailure(error); }
  });
}
