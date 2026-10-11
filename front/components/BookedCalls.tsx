'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useWalletSession } from './WalletSessionProvider';
import { responseError, userErrorMessage } from '@/lib/user-facing-error';

type Call = { id: string; title: string; starts_at: string; role: string; call_path: string };
export default function BookedCalls() {
  const { wallet } = useWalletSession();
  const [snapshot, setSnapshot] = useState<{ wallet: string; calls: Call[]; error: string } | null>(null);
  useEffect(() => {
    if (!wallet) return;
    const controller = new AbortController();
    fetch('/api/calls', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw responseError(response, result, 'No se pudieron cargar tus llamadas.');
      if (!controller.signal.aborted) setSnapshot({ wallet, calls: result.calls, error: '' });
    }).catch(reason => { if (!controller.signal.aborted) setSnapshot({ wallet, calls: [], error: userErrorMessage(reason, 'No se pudieron cargar tus llamadas.') }); });
    return () => controller.abort();
  }, [wallet]);
  const loaded = snapshot?.wallet === wallet ? snapshot : null;
  return <section className="mt-8 rounded-2xl border border-white/15 p-5" aria-labelledby="booked-calls"><h2 id="booked-calls" className="text-xl font-semibold">Mis llamadas reservadas</h2>
    {!loaded ? <p className="mt-3">Cargando llamadas…</p> : loaded.error ? <p role="alert" className="mt-3 text-red-300">{loaded.error}</p> : !loaded.calls.length ? <p className="mt-3 text-zinc-400">Todavía no tienes llamadas confirmadas.</p> : <ul className="mt-4 space-y-4">{loaded.calls.map(call => <li key={call.id}><Link href={call.call_path} className="block rounded-xl border border-violet-400/30 p-4 text-violet-200 underline">{call.title} · {new Date(call.starts_at).toLocaleString()} · {call.role === 'creator' ? 'Creador' : 'Fan'} — Abrir llamada privada</Link></li>)}</ul>}
  </section>;
}
