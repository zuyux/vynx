'use client';
import { useCopy } from "@/i18n/copy";


import Link from '@/i18n/link';
import { SESSION_DURATIONS, sessionDurationLabel } from '@/lib/offer-terms';
import BookedCalls from './BookedCalls';
import { useEffect, useState, type FormEvent } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { useWalletSession } from '@/components/WalletSessionProvider';
import { LoadingState } from '@/components/LoadingState';
import { EMPTY_CALL_OFFER, WEEKDAYS, callOfferFields, type CallOffer, type CallOfferInput } from '@/lib/call-offer';
import { responseError, UserFacingError, userErrorMessage } from '@/lib/user-facing-error';

const input = 'mt-2 w-full min-w-0 rounded-xl border border-white/20 bg-[#17131e] px-3 py-3 text-base text-white outline-none focus:ring-2 focus:ring-violet-400';
const button = 'min-h-11 rounded-xl border border-white/20 px-4 py-3 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-violet-400 disabled:opacity-50';
const zones = ['UTC', 'America/Lima', 'America/Bogota', 'America/Mexico_City', 'America/Argentina/Buenos_Aires', 'America/New_York', 'America/Los_Angeles', 'Europe/Madrid', 'Europe/London', 'Asia/Tokyo'];

function OfferEditor({ offer, owner, onSaved }: { offer: CallOffer | null; owner: string; onSaved: (offer: CallOffer) => void }) {
  const t = useCopy();
  const session = useWalletSession();
  const [draft, setDraft] = useState<CallOfferInput>(offer ?? structuredClone(EMPTY_CALL_OFFER));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);
  const change = <K extends keyof CallOfferInput>(key: K, value: CallOfferInput[K]) => setDraft(previous => ({ ...previous, [key]: value }));
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice(''); setFailed(false);
    try {
      callOfferFields(draft);
      if (await session.ensureSession() !== owner) throw new UserFacingError(t("Your wallet changed. Reload the service before saving."));
      const response = await fetch('/api/call-offer', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
      const result = await response.json();
      if (!response.ok) throw responseError(response, result, t("Could not save your service. Your draft is preserved."));
      setDraft(result.offer); onSaved(result.offer);
      setNotice(t("Service saved to your account."));
    } catch (reason) { setFailed(true); setNotice(userErrorMessage(reason, t("Could not save your service. Your draft is preserved."))); }
    finally { setBusy(false); }
  }
  return <form onSubmit={event => void save(event)} className="mt-7 space-y-6">
    <fieldset disabled={busy} className="min-w-0 space-y-6 disabled:opacity-60"><legend className="sr-only">{t("Set up a video call service")}</legend>
      <label className="block text-sm text-zinc-300">{t("Service name")}<input name="title" required minLength={3} maxLength={100} value={draft.title} onChange={event => change('title', event.target.value)} placeholder={t("Design mentoring")} className={input} /></label>
      <label className="block text-sm text-zinc-300">{t("What the service includes")}<textarea name="description" required minLength={10} maxLength={2000} rows={4} value={draft.description} onChange={event => change('description', event.target.value)} placeholder={t("Explain what you will work on together and what the participant will receive afterward.")} className={`${input} resize-y`} /></label>
      <div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm text-zinc-300">{t("Session duration")}<select name="duration_minutes" required value={draft.duration_minutes} onChange={event => change('duration_minutes', Number(event.target.value))} className={input}>{!(SESSION_DURATIONS as readonly number[]).includes(draft.duration_minutes) && <option value={draft.duration_minutes}>{draft.duration_minutes}{t(" min (current)")}</option>}{SESSION_DURATIONS.map(duration => <option key={duration} value={duration}>{sessionDurationLabel(duration, t.locale)}</option>)}</select></label>
      <label className="block text-sm text-zinc-300">{t("Price (test USDC)")}<input name="price" type="number" required min="0.01" max="1000" step="0.000001" value={draft.price} onChange={event => change('price', event.target.value)} className={input} /><span className="mt-2 block text-xs leading-5 text-zinc-400">{t("From 0.01 to 1000 USDC per session. Solana devnet; tokens have no monetary value.")}</span></label></div>
      <label className="block text-sm text-zinc-300">{t("Booking time zone")}<input name="timezone" required list="booking-timezones" value={draft.timezone} onChange={event => change('timezone', event.target.value)} className={input} aria-describedby="timezone-help" /><datalist id="booking-timezones">{zones.map(zone => <option key={zone} value={zone} />)}</datalist><span id="timezone-help" className="mt-2 block text-xs leading-6 text-zinc-400">{t("Use an IANA time zone such as America/Lima or Europe/Madrid. All times below are local to this zone; zones with daylight saving time keep the local time.")}</span></label>
      <fieldset className="min-w-0 rounded-2xl border border-white/15 p-4"><legend className="px-2 text-sm font-semibold">{t("Weekly availability")}</legend><p className="mb-4 text-xs leading-6 text-zinc-400">{t("Add availability windows in 15-minute intervals. Each window must fit within one day and allow a full session. Windows cannot overlap.")}</p>
        {!draft.availability.length && <p className="mb-4 text-sm text-zinc-300">{t("You have not set availability yet.")}</p>}
        <div className="space-y-4">{draft.availability.map((window, index) => <div key={index} className="grid min-w-0 gap-3 rounded-xl border border-white/10 p-3 sm:grid-cols-2">
          <label className="block text-xs text-zinc-300">{t("Availability day ")}{index + 1}<select value={window.weekday} onChange={event => change('availability', draft.availability.map((item, i) => i === index ? { ...item, weekday: Number(event.target.value) } : item))} className={input}>{WEEKDAYS.map((day, value) => <option key={day} value={value}>{t(day)}</option>)}</select></label>
          <div className="grid min-w-0 grid-cols-2 gap-3">{(['start', 'end'] as const).map(key => <label key={key} className="block min-w-0 text-xs text-zinc-300">{key === 'start' ? t("Start") : t("End")}{t(" for availability window ")}{index + 1}<input type="time" required step={900} value={window[key]} onChange={event => change('availability', draft.availability.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item))} className={input} /></label>)}</div>
          <button type="button" onClick={() => change('availability', draft.availability.filter((_, i) => i !== index))} className={`${button} sm:col-span-2`} aria-label={t("Remove availability window {v0}", {v0: index + 1})}>{t("Remove availability window")}</button>
        </div>)}</div>
        <button type="button" disabled={draft.availability.length >= 28} onClick={() => change('availability', [...draft.availability, { weekday: 1, start: '09:00', end: '12:00' }])} className={`${button} mt-4 w-full`}>{t("Add weekly availability")}</button>
      </fieldset>
      <label className="flex items-start gap-3 text-sm text-zinc-300"><input name="accepting" type="checkbox" checked={draft.accepting} onChange={event => change('accepting', event.target.checked)} className="mt-1 size-4 shrink-0 accent-violet-400" /><span>{t("Accept service bookings")}<span className="mt-1 block text-xs leading-6 text-zinc-400">{t("Save with this enabled to make your available slots bookable. Pausing keeps your saved settings and availability.")}</span></span></label>
      <button className="min-h-12 w-full rounded-xl bg-violet-400 px-5 py-3 font-semibold text-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400">{busy ? t('Saving…') : t("Save service")}</button>
    </fieldset>
    {notice && <p role={failed ? 'alert' : 'status'} className={`rounded-xl border p-4 text-sm ${failed ? 'border-red-400/40 text-red-300' : 'border-emerald-400/30 text-emerald-300'}`}>{t(notice)}</p>}
  </form>;
}

export default function CallOfferWorkspace() {
  const t = useCopy();
  const { wallet } = useWalletSession();
  const [snapshot, setSnapshot] = useState<{ wallet: string; offer: CallOffer | null; error: string } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!wallet) return;
    const controller = new AbortController();
    fetch('/api/call-offer', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw responseError(response, result, t("Could not load your service."));
      if (!controller.signal.aborted) setSnapshot({ wallet, offer: result.offer, error: '' });
    }).catch(reason => { if (!controller.signal.aborted) setSnapshot({ wallet, offer: null, error: userErrorMessage(reason, t("Could not load your service.")) }); });
    return () => controller.abort();
  }, [wallet, retry, t]);
  const loaded = snapshot?.wallet === wallet ? snapshot : null;
  return <div className="min-h-screen bg-[#08080b] text-white"><Sidebar /><main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:ml-64 lg:px-12">
    <Link href="/dashboard/card" className="text-sm text-violet-300 underline">{t("Back to My Card")}</Link>
    <h1 className="mt-5 text-3xl font-semibold">{t("My video call service")}</h1><p className="mt-3 text-sm leading-7 text-zinc-300">{t("Set your service, duration, price, and availability. You can save one service per wallet and update it whenever you want.")}</p>
    <p className="mt-5 rounded-xl border border-violet-400/30 bg-violet-400/10 p-4 text-sm leading-7 text-violet-200">{t("Enable bookings and save your availability to make your service bookable. When a fan books and pays, their wallet creates the booking record and funds escrow in one transaction. Confirmed bookings include a private call link. Payments use test USDC on Solana devnet.")}</p>
    <BookedCalls key={wallet} />
    {!loaded ? <LoadingState label={t("Loading your service…")} /> : loaded.error ? <div className="mt-6"><p role="alert" className="text-red-300">{t(loaded.error)}</p><button onClick={() => { setSnapshot(null); setRetry(value => value + 1); }} className={`${button} mt-4`}>{t("Retry loading")}</button></div> : <OfferEditor key={wallet} owner={wallet} offer={loaded.offer} onSaved={offer => setSnapshot({ wallet, offer, error: '' })} />}
  </main></div>;
}
