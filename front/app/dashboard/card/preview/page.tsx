'use client';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { useWalletSession } from '@/components/WalletSessionProvider';
import { PublicCreatorCard } from '@/components/PublicCreatorCard';
import { DRAFT_KEY, readDraft, type CreatorDraft } from '@/lib/creator-draft';
import { WalletAuthGate } from '@/components/WalletAuthGate';
import { LoadingState } from '@/components/LoadingState';

const subscribe = () => () => {};
export default function DraftPreviewPage() {
  const { wallet, checking } = useWalletSession();
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  if (!ready || checking) return <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#07070a] p-8 text-zinc-400"><LoadingState label="Loading your draft…" /></main>;
  if (!wallet) return <WalletAuthGate title="Open your draft preview" description="Sign in with the wallet that owns your saved draft." />;
  return <DraftPreview key={wallet} wallet={wallet} />;
}
function DraftPreview({ wallet }: { wallet: string }) {
  const [result] = useState<{draft:CreatorDraft | null;error:string}>(() => {
    try {
      const raw = localStorage.getItem(`${DRAFT_KEY}:${wallet}`);
      return {draft:raw ? readDraft(raw) : null,error:''};
    } catch { return {draft:null,error:"Could not recover the saved draft."}; }
  });
  if (!result.draft) return <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center bg-[#07070a] p-6 text-white"><section className="max-w-lg rounded-3xl border border-white/10 bg-[#101015] p-8"><h1 className="text-2xl font-semibold">First, shape your page</h1><p className="mt-4 text-sm leading-7 text-zinc-400">{result.error || "Save a draft in the editor to view it as a full page. It will only be available in this browser."}</p><Link href="/dashboard/card" className="mt-6 inline-block rounded-xl bg-[#00F5A0] px-5 py-3 text-sm font-semibold text-black">Back to editor</Link></section></main>;
  const draft = result.draft;
  return <PublicCreatorCard creator={{ id: 'draft', wallet, alias: draft.alias, tipsEnabled: true, design: draft }} preview />;
}
