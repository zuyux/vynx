import type { Metadata } from 'next';
import Link from 'next/link';
import HomePage from '@/components/HomePage';
import { publishedCreators } from '@/lib/published-creators';
import { jsonLd, siteUrl, SITE_DESCRIPTION, SITE_TITLE } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { alternates: { canonical: siteUrl() },
  openGraph: { type: 'website', siteName: 'VYNX', url: siteUrl(), title: SITE_TITLE, description: SITE_DESCRIPTION, images: [{ url: '/hero-card-asset.png', alt: 'VYNX creator card' }] } };

export default async function Home() {
  // Keep the landing page available if profile storage temporarily fails.
  const creators = await publishedCreators(0, 12).catch(() => []);
  const structuredData = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Organization', '@id': siteUrl('/#organization'), name: 'VYNX', url: siteUrl(), logo: siteUrl('/logo.png') },
    { '@type': 'WebSite', '@id': siteUrl('/#website'), name: 'VYNX', url: siteUrl(), description: SITE_DESCRIPTION, publisher: { '@id': siteUrl('/#organization') } },
  ] };
  return <HomePage>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    {creators.length > 0 && <section aria-labelledby="published-creators" className="px-5 py-12 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1480px]">
        <h2 id="published-creators" className="heading-font text-3xl sm:text-4xl">Discover VYNX creators</h2>
        <p className="mt-3 text-white/60">Explore published creator cards, find their links, and support their work.</p>
        <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{creators.map(creator => <li key={creator.username}>
          <Link href={`/${creator.username}`} className="block rounded-2xl border border-white/10 p-5 transition hover:border-violet-400/50">
            <h3 className="text-lg font-semibold">{creator.display_name || creator.username}</h3>
            <p className="mt-1 text-sm text-violet-300">@{creator.username}</p>
            {creator.bio && <p className="mt-3 line-clamp-2 text-sm text-white/60">{creator.bio}</p>}
          </Link>
        </li>)}</ul>
      </div>
    </section>}
  </HomePage>;
}
