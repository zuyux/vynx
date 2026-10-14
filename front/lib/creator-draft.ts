import { UserFacingError } from './user-facing-error';
import { readOfferTerms, type OfferTerms } from './offer-terms';
import { storedCreatorImage } from './creator-image-policy';

export const CREATOR_ACCENTS = { purple: '#c65cff', red: '#ff4545', blue: '#4385ff', cyan: '#00d9ed', yellow: '#ffd43b', orange: '#ff922b', black: '#111111', white: '#ffffff', mint: '#00F5A0', violet: '#b69aff', rose: '#ff94b9' } as const;

export type CreatorLink = { id: string; title: string; url: string };
export const OFFER_TYPES = ['digital', 'bookings', 'tickets', 'subscriptions'] as const;
export type CreatorOffer = OfferTerms & { id: string; type: typeof OFFER_TYPES[number]; title: string; description: string; price: string; url: string };
export type CreatorDraft = {
  version: 1; alias: string; name: string; bio: string; avatar: string; cover: string;
  accent: keyof typeof CREATOR_ACCENTS; cardGlow?: boolean; buttonGlow?: boolean; theme: 'dark' | 'light'; rounded: boolean;
  offers?: CreatorOffer[];
  links: CreatorLink[]; socials: { instagram: string; youtube: string; x: string; tiktok?: string; substack?: string; telegram?: string };
};
export const DRAFT_KEY = 'vynx:creator-draft:v1';
export const EMPTY_DRAFT: CreatorDraft = {
  version: 1, alias: '', name: '', bio: '', avatar: '', cover: '', accent: 'mint',
  theme: 'dark', rounded: true, offers: [], links: [], socials: { instagram: '', youtube: '', x: '', tiktok: '', substack: '', telegram: '' },
};
export function safeLink(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function readDraft(raw: string | null): CreatorDraft {
  if (!raw) return structuredClone(EMPTY_DRAFT);
  const value = JSON.parse(raw);
  const bounded = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
  const image = (v: unknown) => {
    if (v === '') return true;
    if (typeof v === 'string' && v.length <= 2048 && storedCreatorImage(v)) return true;
    if (!bounded(v, 1500000) || typeof v !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(v)) return false;
    const base64 = v.slice(v.indexOf(',') + 1);
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return base64.length % 4 === 0 && base64.length * 3 / 4 - padding <= 1024 * 1024;
  };
  if (!value || value.version !== 1 || !bounded(value.alias, 30) || !bounded(value.name, 60) || !bounded(value.bio, 280) ||
      !image(value.avatar) || !image(value.cover) || !Object.prototype.hasOwnProperty.call(CREATOR_ACCENTS, value.accent) ||
      (value.cardGlow !== undefined && typeof value.cardGlow !== 'boolean') ||
      (value.buttonGlow !== undefined && typeof value.buttonGlow !== 'boolean') ||
      !['dark', 'light'].includes(value.theme) || typeof value.rounded !== 'boolean' ||
      (value.offers !== undefined && (!Array.isArray(value.offers) || value.offers.length > 8 ||
        !value.offers.every((offer: CreatorOffer) => offer && bounded(offer.id, 60) && OFFER_TYPES.includes(offer.type) && bounded(offer.title, 60) && bounded(offer.description, 280) && bounded(offer.price, 60) && bounded(offer.url, 500)) ||
        new Set(value.offers.map((offer: CreatorOffer) => offer.id)).size !== value.offers.length)) ||
      !Array.isArray(value.links) || value.links.length > 8 ||
      !value.links.every((link: CreatorLink) => link && bounded(link.id, 60) && bounded(link.title, 60) && bounded(link.url, 500)) ||
      new Set(value.links.map((link: CreatorLink) => link.id)).size !== value.links.length ||
      !value.socials || !['tiktok', 'substack', 'telegram'].every(key => value.socials[key] === undefined || bounded(value.socials[key], 500)) || !['instagram', 'youtube', 'x'].every(key => bounded(value.socials[key], 500))) {
    throw new UserFacingError("The saved draft is incompatible. You can create a new one.");
  }
  // Return only supported fields; never persist arbitrary client properties.
  return { version: 1, alias: value.alias, name: value.name, bio: value.bio,
    avatar: value.avatar, cover: value.cover, accent: value.accent, theme: value.theme,
    cardGlow: value.cardGlow ?? false, buttonGlow: value.buttonGlow ?? false,
    offers: (value.offers ?? []).map((offer: CreatorOffer) => ({ id: offer.id, type: offer.type, title: offer.title, description: offer.description, price: offer.price, url: offer.url, ...readOfferTerms(offer) })),
    rounded: value.rounded, links: value.links.map((link: CreatorLink) => ({ id: link.id, title: link.title, url: link.url })),
    socials: { instagram: value.socials.instagram, youtube: value.socials.youtube, x: value.socials.x, tiktok: value.socials.tiktok ?? '', substack: value.socials.substack ?? '', telegram: value.socials.telegram ?? '' } };
}
export function publicationFields(value: unknown): CreatorDraft {
  const draft = readDraft(JSON.stringify(value) ?? null);
  const error = validateDraft(draft);
  if (error) throw new Error(error);
  return { ...draft, name: draft.name.trim(), bio: draft.bio.trim(),
    offers: (draft.offers ?? []).map(offer => ({ ...offer, title: offer.title.trim(), description: offer.description.trim(), price: offer.price.trim(), url: offer.url ? safeLink(offer.url) ?? '' : '' })),
    links: draft.links.map(link => ({ ...link, title: link.title.trim(), url: safeLink(link.url)! })),
    socials: { instagram: draft.socials.instagram ? safeLink(draft.socials.instagram)! : '',
      youtube: draft.socials.youtube ? safeLink(draft.socials.youtube)! : '', x: draft.socials.x ? safeLink(draft.socials.x)! : '',
      tiktok: draft.socials.tiktok ? safeLink(draft.socials.tiktok)! : '',
      substack: draft.socials.substack ? safeLink(draft.socials.substack)! : '',
      telegram: draft.socials.telegram ? safeLink(draft.socials.telegram)! : '' } };
}
export function draftFromProfile(profile: { alias: string; display_name: string; bio: string; website?: string; design?: unknown }): CreatorDraft {
  const draft = profile.design ? readDraft(JSON.stringify(profile.design)) : structuredClone(EMPTY_DRAFT);
  if (!profile.design && profile.website && safeLink(profile.website)) {
    draft.links = [{ id: 'website', title: 'My website and projects', url: safeLink(profile.website)! }];
  }
  return { ...draft, alias: profile.alias, name: profile.display_name, bio: profile.bio };
}
export function validateDraft(draft: CreatorDraft): string | null {
  if (!/^[a-z0-9_]{1,30}$/.test(draft.alias)) return "The alias must contain 1 to 30 letters, numbers, or underscores.";
  if (!draft.name.trim()) return "Add your creator name.";
  if ((draft.offers ?? []).some(offer => !offer.title.trim() || (offer.url && !safeLink(offer.url)))) return "Add a title for each offer and use a valid HTTPS URL for any more details page.";
  try { for (const offer of draft.offers ?? []) readOfferTerms(offer); }
  catch (reason) { return reason instanceof Error ? reason.message : 'Check the offer schedule.'; }
  if ((draft.offers ?? []).some(offer => !/^(?:0|[1-9]\d{0,3})(?:\.\d{1,6})?$/.test(offer.price.trim()))) return "Enter a numeric USDC price for each offer.";
  if ((draft.offers ?? []).some(offer => offer.billingPeriod === 'month' && (Number(offer.price) < 0.01 || Number(offer.price) > 1000))) return 'Monthly prices must be between 0.01 and 1000 USDC.';
  if ((draft.offers ?? []).some(offer => offer.billingPeriod === 'month' && offer.type === 'bookings' && (!(offer.schedule?.length) || !offer.timezone || !offer.durationMinutes))) return "Add a time zone, session duration, and weekly session times for monthly bookings.";
  if (draft.links.some(link => !link.title.trim() || !safeLink(link.url))) return "Add a title and a valid HTTPS URL for each link.";
  if (Object.values(draft.socials).some(url => url && !safeLink(url))) return "Use valid HTTPS links for your social profiles.";
  return null;
}
