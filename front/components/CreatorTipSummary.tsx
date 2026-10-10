'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useWalletSession } from '@/components/WalletSessionProvider';
import { formatTipUnits, type TipCurrency } from '@/lib/tip-currency';

type Snapshot = { wallet: string; profile: { username: string; display_name: string | null; published: boolean }; tips: { lamports: string; usdc_units: string; count: number; recent: { id: string; currency: TipCurrency; lamports: number | null; token_amount: number | null; signature: string; created_at: string }[] } };
export function CreatorTipSummary() {
  const { wallet } = useWalletSession();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!wallet) return;
    const controller = new AbortController();
    fetch('/api/dashboard', { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result; })
      .then(result => { if (!controller.signal.aborted) { setSnapshot({wallet,...result}); setError(''); } })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to load tips.'); });
    return () => controller.abort();
  }, [wallet, attempt]);
  const current = snapshot?.wallet === wallet ? snapshot : null;
  return <section className="mt-8 rounded-2xl border border-white/10 bg-[#101015] p-6 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Tu Creator Card y propinas</h2><button onClick={() => setAttempt(value => value + 1)} className="rounded-lg px-3 py-2 text-xs text-zinc-400 hover:bg-white/5">Actualizar propinas</button></div>
    {error ? <p role="alert" className="mt-4 text-sm text-red-200">{error}</p> : !current ? <p role="status" className="mt-4 text-sm text-zinc-400">Cargando tu perfil y propinas…</p> : <>
      <div className="mt-5 grid gap-4 sm:grid-cols-3"><div><p className="text-xs text-zinc-500">Tu alias comprado</p><p className="mt-2 text-xl font-semibold">@{current.profile.username}</p></div><div><p className="text-xs text-zinc-500">Propinas verificadas · devnet</p><p data-testid="tip-total" className="mt-2 text-xl font-semibold text-[#00F5A0]">{formatTipUnits(current.tips.usdc_units, 'USDC')} USDC</p><p data-testid="tip-total-sol" className="mt-1 text-sm text-zinc-400">{formatTipUnits(current.tips.lamports, 'SOL')} SOL</p></div><div><p className="text-xs text-zinc-500">Propinas recibidas</p><p data-testid="tip-count" className="mt-2 text-xl font-semibold">{current.tips.count}</p></div></div>
      <div className="mt-5 flex flex-wrap gap-4 text-sm"><Link href="/dashboard/card" className="text-violet-300">{current.profile.published ? 'Editar mi página' : 'Publicar mi página'} ↗</Link>{current.profile.published && <Link href={`/${current.profile.username}`} className="text-[#00F5A0]">Ver página pública ↗</Link>}</div>
      {current.tips.recent.length ? <ul className="mt-5 divide-y divide-white/5">{current.tips.recent.map(tip => <li key={tip.id} className="flex flex-wrap justify-between gap-3 py-3 text-xs"><span>{formatTipUnits((tip.currency === 'USDC' ? tip.token_amount : tip.lamports) ?? 0, tip.currency)} {tip.currency} · {new Date(tip.created_at).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}</span><a target="_blank" rel="noopener noreferrer" className="text-violet-300" href={`https://explorer.solana.com/tx/${tip.signature}?cluster=devnet`}>Ver transferencia ↗</a></li>)}</ul> : <p className="mt-5 text-xs text-zinc-500">Comparte tu página para recibir tu primera propina.</p>}
    </>}
  </section>;
}
