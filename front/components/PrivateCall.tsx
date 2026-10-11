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
        if (!response.ok) throw responseError(response, result, "Could not load the call.");
        if (!controller.signal.aborted) setSnapshot({ wallet: session.wallet, ...result });
      } catch (reason) { if (!controller.signal.aborted) setError(userErrorMessage(reason, "Could not load the call.")); }
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
    }).catch(reason => { if (!cancelled) { setError(userErrorMessage(reason, 'Could not join. Try again.')); setAccess(null); } });
    return () => { cancelled = true; if (current) void current.destroy(); };
  }, [access, session.wallet]);
  async function join() {
    setError(''); setBusy(true);
    try {
      const wallet = await session.ensureSession();
      if (wallet !== session.wallet) throw new Error('Wallet changed');
      const response = await fetch('/api/calls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const result = await response.json();
      if (!response.ok) throw responseError(response, result, "Could not join the call.");
      setAccess({ wallet, url: result.url, token: result.token });
    } catch (reason) { setError(userErrorMessage(reason, "Could not join the call.")); }
    finally { setBusy(false); }
  }
  const loaded = snapshot?.wallet === session.wallet ? snapshot : null;
  const joined = access?.wallet === session.wallet;
  return <main id="main-content" className="mx-auto min-h-screen max-w-5xl px-5 py-8 text-white">
    <Link href="/dashboard/bookings" className="text-violet-300 underline">My calls</Link>
    <h1 className="mt-6 text-3xl font-semibold">{loaded?.call.title ?? 'Private video call'}</h1>
    {!session.wallet ? <button onClick={() => void session.authenticate().catch(reason => setError(userErrorMessage(reason, "Could not sign in.")))} className="mt-6 rounded-xl bg-violet-400 p-4 text-black">Connect wallet and sign in</button> : loaded && <>
      <p className="mt-4">{new Date(loaded.call.starts_at).toLocaleString('en-US')} · {loaded.call.role === 'creator' ? 'Creator' : 'Fan'}</p>
      <p className="mt-3 text-sm text-zinc-300">Access opens 10 minutes before and closes 10 minutes after your booking. Only the two booked wallets can join. This call is not recorded.</p>
      <button disabled={busy} onClick={() => joined ? setAccess(null) : void join()} className="mt-6 rounded-xl bg-violet-400 p-4 font-semibold text-black disabled:opacity-50">{busy ? 'Preparing access…' : joined ? "Leave call" : "Join call"}</button>
      {loaded.attendance && <p className="mt-4 text-sm" role="status">Verified simultaneous attendance: {Math.floor(loaded.attendance.simultaneous_seconds / 60)} of {Math.floor(loaded.attendance.scheduled_seconds / 60)} minutes. {loaded.attendance.evidence_status === 'incomplete' ? "Evidence is still incomplete; waiting for provider events." : 'Signed events received.'} Attendance does not automatically release escrow.</p>}
    </>}
    {error && <p role="alert" className="mt-4 text-red-300">{error}</p>}
    <div ref={container} aria-label="Private video call room" className={joined ? 'mt-6 h-[70vh] min-h-96 w-full overflow-hidden rounded-2xl bg-zinc-900' : 'hidden'} />
  </main>;
}
