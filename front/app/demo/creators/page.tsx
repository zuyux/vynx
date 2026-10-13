import type { Metadata } from 'next';
import Link from 'next/link';
import profiles from '@/data/demo-profiles.json';
import { appDb } from '@/lib/app-db';
import { draftFromProfile } from '@/lib/creator-draft';
import { PublicCreatorCard } from '@/components/PublicCreatorCard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Demo creators | VYNX', robots: { index: false, follow: false } };
export default async function DemoCreatorsPage() {
  const { data, error } = await appDb().from('cards_users')
    .select('id,username,wallet_address,display_name,bio,design')
    .in('id', profiles.map(profile => profile.id));
  if (error) throw new Error('Demo profiles are temporarily unavailable.');
  return <main id="main-content" className="min-h-screen bg-[#08080b] px-4 py-10 text-white sm:px-8">
    <div className="mx-auto max-w-7xl">
      <Link href="/dashboard/studio" className="text-sm text-violet-300">← Studio</Link>
      <h1 className="mt-6 text-4xl font-semibold">Meet the demo creators</h1>
      <p className="mt-3 max-w-2xl text-white/60">Four fictional profiles with AI-generated portraits and demo wallets on Solana devnet. Their cards contain placeholder information for testing.</p>
      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {profiles.map(profile => {
          const row = data?.find(row => row.id === profile.id && row.username === profile.alias && row.wallet_address === profile.wallet);
          if (!row) return null;
          return <section key={profile.id} aria-label={`${profile.name}, ${profile.role}`}>
            <p className="mb-3 text-sm text-violet-200">{profile.role}</p>
            <PublicCreatorCard preview embedded creator={{id:row.id,alias:row.username,wallet:row.wallet_address,tipsEnabled:false,published:false,
              design:draftFromProfile({alias:row.username,display_name:row.display_name,bio:row.bio,design:row.design})}} />
          </section>;
        })}
      </div>
      {!data?.length && <p className="mt-8">Run the demo profile seed to populate this gallery.</p>}
    </div>
  </main>;
}
