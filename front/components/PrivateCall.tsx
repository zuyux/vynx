'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useWalletSession } from './WalletSessionProvider';
import { responseError, userErrorMessage } from '@/lib/user-facing-error';

type Call = { id: string; title: string; starts_at: string; ends_at: string; role: string };
type Evidence = { simultaneous_seconds: number; scheduled_seconds: number; evidence_status: string; gaps: string[] };
export default function PrivateCall({ id }: { id: string }) {
  const session = useWalletSession();
  const [snapshot, setSnapshot] = useState<{ wallet: string; call: Call; attendance: Evidence | null } | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState<{ wallet: string; url: string; token: string } | null>(null);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!session.wallet) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/calls?id=${encodeURIComponent(id)}`, { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw responseError(response, result, 'No se pudo cargar la llamada.');
        if (!controller.signal.aborted) setSnapshot({ wallet: session.wallet, ...result });
      } catch (reason) { if (!controller.signal.aborted) setError(userErrorMessage(reason, 'No se pudo cargar la llamada.')); }
    }
    void load(); const timer = setInterval(() => void load(), 15_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [id, session.wallet]);
  useEffect(() => {
    if (!access || access.wallet !== session.wallet || !container.current) return;
    let cancelled = false; let current: import('@daily-co/daily-js').DailyCall | null = null;
    const host = container.current;
    void import('@daily-co/daily-js').then(async ({ default: Daily }) => {
      if (cancelled) return;
      current = Daily.createFrame(host, { showLeaveButton: true, iframeStyle: { width: '100%', height: '100%', border: '0' } });
      await current.join({ url: access.url, token: access.token });
    }).catch(reason => { if (!cancelled) { setError(userErrorMessage(reason, 'No se pudo entrar. Intenta de nuevo.')); setAccess(null); } });
    return () => { cancelled = true; if (current) void current.destroy(); };
  }, [access, session.wallet]);
  async function join() {
    setError(''); setBusy(true);
    try {
      const wallet = await session.ensureSession();
      if (wallet !== session.wallet) throw new Error('Wallet changed');
      const response = await fetch('/api/calls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const result = await response.json();
      if (!response.ok) throw responseError(response, result, 'No se pudo entrar a la llamada.');
      setAccess({ wallet, url: result.url, token: result.token });
    } catch (reason) { setError(userErrorMessage(reason, 'No se pudo entrar a la llamada.')); }
    finally { setBusy(false); }
  }
  const loaded = snapshot?.wallet === session.wallet ? snapshot : null;
  const joined = access?.wallet === session.wallet;
  return <main id="main-content" className="mx-auto min-h-screen max-w-5xl px-5 py-8 text-white">
    <Link href="/dashboard/bookings" className="text-violet-300 underline">Mis llamadas</Link>
    <h1 className="mt-6 text-3xl font-semibold">{loaded?.call.title ?? 'Videollamada privada'}</h1>
    {!session.wallet ? <button onClick={() => void session.authenticate().catch(reason => setError(userErrorMessage(reason, 'No se pudo iniciar sesión.')))} className="mt-6 rounded-xl bg-violet-400 p-4 text-black">Conectar wallet e iniciar sesión</button> : loaded && <>
      <p className="mt-4">{new Date(loaded.call.starts_at).toLocaleString()} · {loaded.call.role === 'creator' ? 'Creador' : 'Fan'}</p>
      <p className="mt-3 text-sm text-zinc-300">Acceso desde 10 minutos antes hasta 10 minutos después del horario reservado. Solo pueden entrar las dos wallets de la reserva. Esta llamada no se graba.</p>
      <button disabled={busy} onClick={() => joined ? setAccess(null) : void join()} className="mt-6 rounded-xl bg-violet-400 p-4 font-semibold text-black disabled:opacity-50">{busy ? 'Preparando acceso…' : joined ? 'Salir de la llamada' : 'Entrar a la llamada'}</button>
      {loaded.attendance && <p className="mt-4 text-sm" role="status">Asistencia simultánea verificada: {Math.floor(loaded.attendance.simultaneous_seconds / 60)} de {Math.floor(loaded.attendance.scheduled_seconds / 60)} minutos. {loaded.attendance.evidence_status === 'incomplete' ? 'La evidencia sigue incompleta; pendiente de eventos del proveedor.' : 'Eventos firmados recibidos.'} La asistencia no libera el escrow automáticamente.</p>}
    </>}
    {error && <p role="alert" className="mt-4 text-red-300">{error}</p>}
    <div ref={container} aria-label="Sala de videollamada privada" className={joined ? 'mt-6 h-[70vh] min-h-96 w-full overflow-hidden rounded-2xl bg-zinc-900' : 'hidden'} />
  </main>;
}
