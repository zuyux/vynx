import { UserFacingError } from './user-facing-error';
export type SponsorProfile = {
  wallet: string; alias: string; display_name: string; bio: string; website: string;
  price_cents: number; duration_days: number; accepting: boolean;
};
export type SponsorRequest = {
  id: string; creator_wallet: string; brand_wallet: string; brand_name: string;
  headline: string; description: string; destination_url: string;
  price_cents: number; duration_days: number;
  status: 'pending' | 'approved' | 'rejected' | 'active';
  payment_signature: string | null; starts_at: string | null; ends_at: string | null; created_at: string;
};
export type SponsorAction = 'save-profile' | 'save-design' | 'request' | 'list' | 'approve' | 'reject' | 'checkout' | 'confirm';
export type SponsorPayload = Record<string, unknown>;

export function text(value: unknown, max: number, required = true): string {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) {
    throw new UserFacingError("Review the required fields and their length limits.");
  }
  return value.trim();
}

export function httpsUrl(value: unknown, required = true): string {
  const input = text(value, 500, required);
  if (!input && !required) return '';
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
    return url.href;
  } catch { throw new UserFacingError("Use a valid HTTPS link without credentials."); }
}

export function profileFields(data: SponsorPayload) {
  const alias = text(data.alias, 30).toLowerCase();
  if (!/^[a-z0-9_]{1,30}$/.test(alias)) throw new UserFacingError("The alias requires 1–30 letters, numbers, or underscores.");
  const price = Number(data.price_cents);
  const days = Number(data.duration_days);
  if (!Number.isSafeInteger(price) || price < 100 || price > 1000000) throw new UserFacingError("The price must be between 1 and 10,000 USDC.");
  if (![7, 14, 30].includes(days)) throw new UserFacingError("Choose 7, 14, or 30 days.");
  if (typeof data.accepting !== 'boolean') throw new UserFacingError("Invalid offer status.");
  return { alias, display_name: text(data.display_name, 60), bio: text(data.bio, 280, false),
    website: httpsUrl(data.website, false), price_cents: price, duration_days: days, accepting: data.accepting };
}

export function requestFields(data: SponsorPayload) {
  return { brand_name: text(data.brand_name, 60), headline: text(data.headline, 100),
    description: text(data.description, 240), destination_url: httpsUrl(data.destination_url) };
}

export function isLive(campaign: Pick<SponsorRequest, 'status' | 'starts_at' | 'ends_at'>, now = Date.now()) {
  return campaign.status === 'active' && !!campaign.starts_at && !!campaign.ends_at &&
    Date.parse(campaign.starts_at) <= now && Date.parse(campaign.ends_at) > now;
}

export function canReview(campaign: Pick<SponsorRequest, 'status' | 'creator_wallet'>, wallet: string) {
  return campaign.status === 'pending' && campaign.creator_wallet === wallet;
}

export function money(cents: number) {
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
