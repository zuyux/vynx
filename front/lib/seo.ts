import type { Metadata } from 'next';
import type { PublicCreator } from './public-creator';
import { safeLink } from './creator-draft';

export const SITE_NAME = 'VYNX';
export const SITE_TITLE = 'VYNX – Creator Cards, Links & Solana Tips';
export const SITE_DESCRIPTION = 'Create your VYNX creator card with a unique alias, share your links, and receive support from your audience in SOL or USDC on Solana.';

export function siteUrl(path = '/') {
  return new URL(path, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').href;
}

export const PRIVATE_METADATA: Metadata = { robots: { index: false, follow: false, googleBot: { index: false, follow: false } } };

// Escape creator-controlled text before embedding it in an HTML script element.
export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function creatorStructuredData(creator: PublicCreator) {
  const url = siteUrl(`/${creator.alias}`);
  return {
    '@context': 'https://schema.org', '@type': 'ProfilePage', '@id': `${url}#profile`, url,
    mainEntity: {
      '@type': 'Person', '@id': `${url}#person`, name: creator.design.name,
      alternateName: `@${creator.alias}`, description: creator.design.bio, url,
      image: siteUrl(`/${creator.alias}/og`),
      sameAs: Object.values(creator.design.socials).map(safeLink).filter(Boolean),
    },
  };
}
