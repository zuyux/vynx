'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useWalletSession } from '@/components/WalletSessionProvider';
import { formatTipUnits, type TipCurrency } from '@/lib/tip-currency';
import { LoadingState } from '@/components/LoadingState';
import { responseError } from '@/lib/user-facing-error';

type Snapshot = { wallet: string; profile: { username: string; display_name: string | null; published: boolean }; tips: { lamports: string; usdc_units: string; count: number; recent: { id: string; currency: TipCurrency; lamports: number | null; token_amount: number | null; signature: string; payer?: string; created_at: string }[] } };
export function CreatorTipSummary() {
  const { wallet, checking } = useWalletSession();
  if (checking) return <LoadingState label="Checking your session…" />;
  if (!wallet) return <section className="mt-8 rounded-2xl border border-white/10 bg-[#101015] p-6"><h2 className="text-lg font-semibold">Your Creator Card and tips</h2><p className="mt-3 text-sm text-zinc-400">Sign in to view your page and tips.</p></section>;
  return <WalletTipSummary key={wallet} wallet={wallet} />;
}
function WalletTipSummary({ wallet }: { wallet: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [missingProfile, setMissingProfile] = useState(false);
  useEffect(() => {
    if (!wallet) return;
    const controller = new AbortController();
    fetch('/api/dashboard', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]), cache: 'no-store' })
      .then(async response => { const result = await response.json(); if (!response.ok) throw responseError(response, result, "Could not load your tips. Try again."); return result; })
      .then(result => { if (!controller.signal.aborted) { setSnapshot({wallet,...result}); setError(''); } })
      .catch(reason => {
        if (controller.signal.aborted) return;
        if (reason?.code === 'ALIAS_REQUIRED') setMissingProfile(true);
        else setError("Could not load your tips. Try again.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [wallet, attempt]);
  const current = snapshot?.wallet === wallet ? snapshot : null;
  return <section aria-busy={loading} className="mt-8 rounded-2xl border border-white/10 bg-[#101015] p-6 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Your Creator Card and tips</h2><button disabled={loading} onClick={() => { setError(''); setMissingProfile(false); setLoading(true); setAttempt(value => value + 1); }} className="rounded-lg px-3 py-2 text-xs text-zinc-400 hover:bg-white/5 disabled:opacity-40">{loading ? "Loading…" : error ? "Retry" : 'Refresh tips'}</button></div>
    {error ? <p role="alert" className="mt-4 text-sm text-red-200">{error}</p> : missingProfile ? <div className="mt-4"><p className="text-sm text-zinc-400">You do not have a Creator Card yet.</p><Link href="/profile/buy-alias" className="mt-3 inline-block text-sm text-violet-300">Choose my alias ↗</Link></div> : !current ? <LoadingState label="Loading your profile and tips…" /> : <>
      <div className="mt-5 grid gap-4 sm:grid-cols-3"><div><p className="text-xs text-zinc-400">Your purchased alias</p><p className="mt-2 text-xl font-semibold">@{current.profile.username}</p></div><div><p className="text-xs text-zinc-400">Verified tips · devnet</p><p data-testid="tip-total" className="mt-2 text-xl font-semibold text-[#00F5A0]">{formatTipUnits(current.tips.usdc_units, 'USDC')} USDC</p><p data-testid="tip-total-sol" className="mt-1 text-sm text-zinc-400">{formatTipUnits(current.tips.lamports, 'SOL')} SOL</p></div><div><p className="text-xs text-zinc-400">Tips received</p><p data-testid="tip-count" className="mt-2 text-xl font-semibold">{current.tips.count}</p></div></div>
      <div className="mt-5 flex flex-wrap gap-4 text-sm"><Link href="/dashboard/card" className="text-violet-300">{current.profile.published ? "Edit my page" : "Publish my page"} ↗</Link>{current.profile.published && <Link href={`/${current.profile.username}`} className="text-[#00F5A0]">View public page ↗</Link>}</div>
      {current.tips.recent.length ? <ul className="mt-5 divide-y divide-white/5">{current.tips.recent.map(tip => <li key={tip.id} className="flex flex-wrap justify-between gap-3 py-3 text-xs"><span>{formatTipUnits((tip.currency === 'USDC' ? tip.token_amount : tip.lamports) ?? 0, tip.currency)} {tip.currency} · {new Date(tip.created_at).toLocaleDateString('en-US', { timeZone: 'America/Lima' })}<span className="mt-1 block break-all text-zinc-400">{tip.payer ? `From: ${tip.payer}` : "Sender address hidden"}</span></span><a target="_blank" rel="noopener noreferrer" className="text-violet-300" href={`https://explorer.solana.com/tx/${tip.signature}?cluster=devnet`}>View transfer ↗</a></li>)}</ul> : <p className="mt-5 text-xs text-zinc-400">Share your page to receive your first tip.</p>}
    </>}
  </section>;
}
