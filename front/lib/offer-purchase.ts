import type { CreatorOffer } from './creator-draft';

export const OFFER_PAYMENT_POLICY = 'vynx-offer-devnet-v1';
export type OfferPurchase = { id: string; terms: CreatorOffer; price_units: number; state: 'awaiting_payment' | 'paid'; payment_signature: string | null };
export const offerPurchaseMemo = (id: string) => `vynx:offer:${id}`;
export function offerPriceUnits(price: string) {
  if (!/^(?:0|[1-9]\d{0,3})(?:\.\d{1,6})?$/.test(price.trim())) throw new Error('Enter a numeric USDC price.');
  const [whole, fraction = ''] = price.trim().split('.');
  const units = Number(BigInt(whole) * BigInt(1_000_000) + BigInt(fraction.padEnd(6, '0')));
  if (units < 10_000) throw new Error('Offer prices must be at least 0.01 USDC.');
  return units;
}
