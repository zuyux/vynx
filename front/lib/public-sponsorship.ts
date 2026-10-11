import { readDraft, type CreatorDraft } from './creator-draft';
import type { SponsorProfile } from './sponsorship-domain';

export const PUBLIC_SPONSOR_COLUMNS = 'wallet,alias,display_name,bio,website,price_cents,duration_days,accepting,design';
export const PUBLIC_AD_COLUMNS = 'id,brand_name,headline,description,destination_url,ends_at';

// Project again after the query so new columns or legacy JSON properties cannot
// silently become public. The creator wallet is a public payment recipient.
export function publicSponsorProfile(profile: SponsorProfile & { design?: unknown }): SponsorProfile & { design: CreatorDraft | null } {
  return {
    wallet: profile.wallet, alias: profile.alias, display_name: profile.display_name,
    bio: profile.bio, website: profile.website, price_cents: profile.price_cents,
    duration_days: profile.duration_days, accepting: profile.accepting,
    design: profile.design ? readDraft(JSON.stringify(profile.design)) : null,
  };
}

type Ad = { id: string; brand_name: string; headline: string; description: string; destination_url: string; ends_at: string };
export function publicSponsorAd(ad: Ad | null): Ad | null {
  return ad ? { id: ad.id, brand_name: ad.brand_name, headline: ad.headline, description: ad.description,
    destination_url: ad.destination_url, ends_at: ad.ends_at } : null;
}
