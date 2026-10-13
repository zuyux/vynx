'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useWalletSession } from './WalletSessionProvider';
import { responseError, userErrorMessage } from '@/lib/user-facing-error';
import type { VerifiedCompletion } from '@/lib/daily-video';
import BookingReview from './BookingReview';

type Call = { id: string; title: string; starts_at: string; ends_at: string; role: string; state: string; billing_period?: 'month' | 'session' };
type Evidence = { simultaneous_seconds: number; scheduled_seconds: number; evidence_status: string; gaps: string[] };
export default function PrivateCall({ id }: { id: string }) {
  const session = useWalletSession();
  const [snapshot, setSnapshot] = useState<{ wallet: string; checkedAt: number; call: Call; attendance: Evidence | null; completion: VerifiedCompletion } | null>(null);
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
        if (!controller.signal.aborted) setSnapshot({ wallet: session.wallet, checkedAt: Date.now(), ...result });
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
  async function transition(state: string) {
    setError(''); setBusy(true);
    try {
      const wallet = await session.ensureSession();
      if (wallet !== session.wallet) throw new Error('Wallet changed');
      const response = await fetch(loaded?.call.billing_period === 'month' ? '/api/monthly-offers' : '/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: loaded?.call.billing_period === 'month' ? 'session' : 'transition', id, state }) });
      const result = await response.json();
      if (!response.ok) throw responseError(response, result, 'Could not update booking.');
      setSnapshot(previous => previous?.wallet === wallet ? { ...previous, call: { ...previous.call, state: result.booking.state } } : previous);
      setAccess(null);
    } catch (reason) { setError(userErrorMessage(reason, 'Could not update booking.')); }
    finally { setBusy(false); }
  }
  const loaded = snapshot?.wallet === session.wallet ? snapshot : null;
  const joined = access?.wallet === session.wallet;
  return <main id="main-content" className="mx-auto min-h-screen max-w-5xl px-5 py-8 text-white">
    <Link href="/dashboard/bookings" className="text-violet-300 underline">My calls</Link>
    <h1 className="mt-6 text-3xl font-semibold">{loaded?.call.title ?? 'Private video call'}</h1>
    {!session.wallet ? <button disabled={session.checking} onClick={() => void session.authenticate().catch(reason => setError(userErrorMessage(reason, "Could not sign in.")))} className="mt-6 rounded-xl bg-violet-400 p-4 text-black disabled:opacity-50">Connect wallet and sign in</button> : loaded && <>
      <p className="mt-4">{new Date(loaded.call.starts_at).toLocaleString('en-US')} · {loaded.call.role === 'creator' ? 'Creator' : 'Fan'}</p>
      <p className="mt-3 text-sm text-zinc-300">Access opens 10 minutes before and closes 10 minutes after your booking. Only the two booked wallets can join. This call is not recorded.</p>
      <p className="mt-3" role="status">Status: {loaded.call.state.replaceAll('_', ' ')}</p>
      <button disabled={busy || (!joined && loaded.call.state !== 'confirmed')} onClick={() => joined ? setAccess(null) : void join()} className="mt-6 rounded-xl bg-violet-400 p-4 font-semibold text-black disabled:opacity-50">{busy ? 'Preparing access…' : joined ? "Leave call" : "Join call"}</button>
      <div className="mt-4 flex flex-wrap gap-3">
        {loaded.call.state === 'confirmed' && <>
          {(loaded.call.billing_period !== 'month' || loaded.call.role === 'creator') && <button disabled={busy} onClick={() => void transition('cancelled')} className="rounded-lg border p-3">Cancel booking</button>}
          {loaded.checkedAt >= Date.parse(loaded.call.ends_at) && <>
            {loaded.call.role === 'fan' && <button disabled={busy} onClick={() => void transition('completed')} className="rounded-lg border p-3">Acknowledge completion</button>}
            <button disabled={busy} onClick={() => void transition('no_show')} className="rounded-lg border p-3">Report no-show</button>
          </>}
        </>}
        {loaded.call.billing_period !== 'month' && ['confirmed', 'completed', 'no_show'].includes(loaded.call.state) && <button disabled={busy} onClick={() => void transition('disputed')} className="rounded-lg border p-3">Open dispute</button>}
      </div>
      <p className="mt-3 text-sm text-zinc-300">{loaded.call.billing_period === 'month' ? 'This session is included in your paid month. Monthly payments go directly to the creator; arrange any refund with them. You can stop future renewals in Monthly plans.' : 'Cancellation requires 24 hours’ notice. Disputes close 24 hours after the call. Status changes do not release or refund escrow.'}</p>
      {loaded.attendance && <p className="mt-4 text-sm" role="status">Verified simultaneous attendance: {Math.floor(loaded.attendance.simultaneous_seconds / 60)} of {Math.floor(loaded.attendance.scheduled_seconds / 60)} minutes. {loaded.attendance.evidence_status === 'incomplete' ? "Evidence is still incomplete; waiting for provider events." : 'Signed events received.'}{loaded.call.billing_period !== 'month' && ' Attendance does not automatically release escrow.'}</p>}
      {loaded.completion && <p className="mt-3 text-sm" role="status">
        {loaded.completion.status === 'verified' ? 'Attendance completion verified.' : loaded.completion.status === 'pending' ? 'Completion verification is pending until the session ends.' : loaded.completion.status === 'below_threshold' ? 'Attendance is below the completion threshold.' : 'Completion verification requires review of missing or incomplete evidence.'}
        {' '}Both participants must attend together for at least {loaded.completion.required_percent}% of the booked duration. This verifies participation and duration; satisfaction and performance ratings are separate. {loaded.call.billing_period === 'month' ? 'Payer acknowledgment does not change this verification.' : 'Payer acknowledgment does not change this verification or release escrow.'}
      </p>}
      {loaded.call.role === 'fan' && <BookingReview key={`${id}:${session.wallet}:${loaded.call.state}`} id={id} />}
    </>}
    {error && <p role="alert" className="mt-4 text-red-300">{error}</p>}
    <div ref={container} aria-label="Private video call room" className={joined ? 'mt-6 h-[70vh] min-h-96 w-full overflow-hidden rounded-2xl bg-zinc-900' : 'hidden'} />
  </main>;
}
