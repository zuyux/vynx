'use client';
import { useCopy } from "@/i18n/copy";

import Link from '@/i18n/link';
import { useEffect, useState } from 'react';
import { useWalletSession } from './WalletSessionProvider';
import { responseError, userErrorMessage } from '@/lib/user-facing-error';

type Call = { id: string; title: string; description?: string; starts_at: string; ends_at: string; role: string; call_path: string; state: string; participant_wallet: string; payment_status: string; price_units: number; currency: string; billing_period: string; expires_at: string };
const labels: Record<string, string> = { awaiting_payment: 'Awaiting payment', confirmed: 'Confirmed', disputed: 'Disputed' };
export default function BookedCalls() {
  const t = useCopy();
  const { wallet } = useWalletSession();
  const [snapshot, setSnapshot] = useState<{ wallet: string; calls: Call[]; error: string } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!wallet) return;
    const controller = new AbortController();
    fetch('/api/calls?view=current', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw responseError(response, result, t('Could not load your calls.'));
      if (!controller.signal.aborted) setSnapshot({ wallet, calls: result.calls, error: '' });
    }).catch(reason => { if (!controller.signal.aborted) setSnapshot({ wallet, calls: [], error: userErrorMessage(reason, t('Could not load your calls.')) }); });
    const timer = window.setInterval(() => setRetry(value => value + 1), 60000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [wallet, retry, t]);
  const loaded = snapshot?.wallet === wallet ? snapshot : null;
  const calls = loaded?.calls ?? [];
  return <section className="mt-8 rounded-2xl border border-white/15 bg-white/[.02] p-5 sm:p-6" aria-labelledby="booked-calls">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="booked-calls" className="text-xl font-semibold">{t("Current booked video calls")}</h2><p className="mt-2 text-sm text-zinc-400">{t("Paid calls and active fan reservations. Times shown in your local time zone.")}</p></div><button type="button" disabled={!wallet} onClick={() => { setSnapshot(null); setRetry(value => value + 1); }} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-violet-400 disabled:opacity-40">{t("Refresh")}</button></div>
    {!wallet ? <p className="mt-5 text-zinc-400">{t("Sign in to see your bookings.")}</p> : !loaded ? <p role="status" className="mt-5 text-zinc-400">{t("Loading calls…")}</p> : loaded.error ? <p role="alert" className="mt-5 text-red-300">{t(loaded.error)}</p> : !calls.length ? <p className="mt-5 rounded-xl border border-dashed border-white/15 p-6 text-zinc-400">{t("No current video calls. Fan reservations and paid upcoming calls will appear here.")}</p> : <><p className="mt-5 text-sm text-zinc-400">{calls.length}{t(" booked · ")}{calls.filter(call => call.payment_status === 'paid').length}{t(" paid · ")}{calls.filter(call => call.payment_status !== 'paid').length}{t(" awaiting payment")}</p><ul className="mt-4 space-y-4">{calls.map(call => <li key={call.id} className="min-w-0 rounded-xl border border-white/10 bg-[#101015] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="text-lg font-medium">{call.title || t('Video call')}</h3><span className={`rounded-full px-3 py-1 text-xs ${call.state === 'confirmed' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-200'}`}>{t(labels[call.state] ?? call.state)}</span></div>
      {call.description && <p className="mt-2 whitespace-pre-line break-words text-sm text-zinc-400">{call.description}</p>}
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-zinc-400">{t("Scheduled time")}</dt><dd className="mt-1"><time dateTime={call.starts_at}>{new Date(call.starts_at).toLocaleString(t.locale, { dateStyle: 'medium', timeStyle: 'short' })}</time> – {new Date(call.ends_at).toLocaleTimeString(t.locale, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</dd></div><div><dt className="text-zinc-400">{t("Duration")}</dt><dd className="mt-1">{Math.round((Date.parse(call.ends_at) - Date.parse(call.starts_at)) / 60000)}{t(" minutes")}</dd></div><div><dt className="text-zinc-400">{call.role === 'creator' ? t('Fan wallet') : t('Creator wallet')}</dt><dd className="mt-1 break-all font-mono text-xs">{call.participant_wallet}</dd></div><div><dt className="text-zinc-400">{t("Payment")}</dt><dd className="mt-1">{(Number(call.price_units) / 1000000).toLocaleString(t.locale, { maximumFractionDigits: 6 })} {call.currency} {call.billing_period === 'month' ? t('/ monthly plan') : t('/ session')} · {call.payment_status === 'paid' ? t('Paid') : t('Awaiting payment')}</dd></div></dl>
      {call.state === 'confirmed' && call.payment_status === 'paid' ? <Link href={call.call_path} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-violet-400 px-4 py-2 text-sm font-semibold text-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400">{t("Open private call")}</Link> : call.state === 'awaiting_payment' ? <p className="mt-4 text-xs text-amber-200">{t("Reserved until ")}{new Date(call.expires_at).toLocaleTimeString(t.locale, { timeStyle: 'short' })}{t(". Call access becomes available after payment is confirmed.")}</p> : null}
    </li>)}</ul>{calls.length === 100 && <p className="mt-4 text-xs text-zinc-400">{t("Showing the next 100 bookings.")}</p>}</>}
  </section>;
}
