'use client';
import { useCopy } from "@/i18n/copy";


import Link from '@/i18n/link';

import { useEffect, useRef, useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Videocall } from '@/components/CardIcons';
import { Transaction } from '@solana/web3.js';
import { useWalletSession } from './WalletSessionProvider';
import { confirmPayment } from '@/lib/payment-client';
import { UserFacingError, responseError, userErrorMessage } from '@/lib/user-facing-error';
import { callPrice, type CallOffer } from '@/lib/call-offer';

type Booking = { id: string; state: string; starts_at: string; signature: string | null; terms: { title: string; timezone: string; duration_minutes?: number }; price_units: number };
type Recovery = { id: string; signature?: string; sending?: boolean };
async function post(body: unknown) {
  const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw responseError(response, result, "Could not complete the booking.");
  return result;
}
export default function CallBookingPanel({ alias, accent = '#00F5A0', accentInk = '#111111' }: { alias: string; accent?: string; accentInk?: string }) {
  const t = useCopy();
  const session = useWalletSession();
  const [schedule, setSchedule] = useState<{ offer: CallOffer; slots: string[] } | null>(null);
  const [slot, setSlot] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [day, setDay] = useState<Date | undefined>();
  const inFlight = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/bookings?alias=${encodeURIComponent(alias)}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => response.ok ? response.json() : null)
      .then(result => { if (!controller.signal.aborted && result) setSchedule(result); })
      .catch(() => { /* The creator's other services remain usable when booking is disabled. */ });
    return () => controller.abort();
  }, [alias]);
  useEffect(() => {
    if (!session.wallet) return;
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      const saved = localStorage.getItem(`vynx:booking:v1:${session.wallet}:${alias}`);
      if (!saved) return;
      const recovery: Recovery = JSON.parse(saved);
      if (typeof recovery.id !== 'string') return;
      const response = await fetch(`/api/bookings?id=${encodeURIComponent(recovery.id)}`, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) return;
      const result = await response.json();
      if (!controller.signal.aborted) { setBooking(result.booking); }
    }).catch(() => { /* Checkout still reads and preserves the saved operation. */ });
    return () => controller.abort();
  }, [alias, session.wallet]);
  async function checkout() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setNotice('');
    try {
      if (!session.connectedWallet) { await session.authenticate(); return; }
      const wallet = await session.ensureSession();
      const key = `vynx:booking:v1:${wallet}:${alias}`;
      // Storage is mandatory before sending. An uncertain wallet result must not
      // turn into a new payment, including after reload or in another tab.
      const saved = localStorage.getItem(key);
      let recovery: Recovery | null = saved ? JSON.parse(saved) : null;
      if (!recovery) {
        const result = await post({ action: 'reserve', alias, slot, accepted_policy: accepted ? 'vynx-escrow-devnet-v1' : '' });
        setBooking(result.booking);
        recovery = { id: result.booking.id };
        localStorage.setItem(key, JSON.stringify(recovery));
      }
      const response = await fetch(`/api/bookings?id=${encodeURIComponent(recovery.id)}`, { cache: 'no-store' });
      const status = await response.json();
      if (!response.ok) throw responseError(response, status, t("Could not recover the booking."));
      setBooking(status.booking);
      if (status.booking.state === 'confirmed') { setNotice(t("Booking confirmed. The escrow deposit was verified.")); return; }
      if (recovery.signature) {
        const signature = recovery.signature;
        const result = await confirmPayment(() => post({ action: 'confirm', id: recovery!.id, signature }));
        setBooking(result.booking); setNotice(t("Booking confirmed. The escrow deposit was verified."));
        localStorage.setItem(key, JSON.stringify({ id: recovery.id, signature }));
        return;
      }
      if (recovery.sending) throw new UserFacingError(t("The submission result is uncertain. Retrieve the signature in your wallet and verify the payment before sending again."));
      const result = await post({ action: 'checkout', id: recovery.id });
      if (result.booking.state === 'confirmed') { setBooking(result.booking); return; }
      const transaction = Transaction.from(Uint8Array.from(atob(result.transaction), c => c.charCodeAt(0)));
      // Persist before opening the wallet; never clear this on an ambiguous error.
      localStorage.setItem(key, JSON.stringify({ ...recovery, sending: true }));
      const { signature } = await session.sendTransaction(transaction, wallet);
      recovery = { id: recovery.id, signature, sending: true };
      localStorage.setItem(key, JSON.stringify(recovery));
      const confirmed = await confirmPayment(() => post({ action: 'confirm', id: recovery!.id, signature }));
      setBooking(confirmed.booking); setNotice(t("Booking confirmed. The escrow deposit was verified."));
    } catch (reason) { setNotice(userErrorMessage(reason, t("Could not complete the booking. Keep the signature and retry verification."))); }
    finally { inFlight.current = false; setBusy(false); }
  }
  if (!schedule) return null;
  const format = (instant: string) => new Intl.DateTimeFormat(t.locale, { timeZone: booking?.terms.timezone ?? schedule.offer.timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(instant));
  const dateKey = (instant: string) => new Intl.DateTimeFormat('en-CA', { timeZone: schedule.offer.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant));
  const calendarKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const availableDays = new Set(schedule.slots.map(dateKey));
  const daySlots = schedule.slots.filter(value => day && dateKey(value) === calendarKey(day));
  const firstDay = schedule.slots.length ? new Date(`${dateKey(schedule.slots[0])}T12:00:00`) : undefined;
  return <section className="mt-6 rounded-2xl border border-current/15 p-6">
    <Videocall size={32} className="mb-4" style={{ color: accent }} />
    <h2 className="text-xl font-semibold">{t("Book a call")}</h2>
    <p className="mt-2">{booking?.terms.title ?? schedule.offer.title} · {booking?.terms.duration_minutes ?? schedule.offer.duration_minutes}{t(" min · ")}{booking ? callPrice(booking.price_units) : schedule.offer.price}{t(" USDC")}</p>
    <p className="mt-3 text-sm">{t("Funds are held until resolution. Full refund if the creator cancels or you cancel at least 24 hours in advance. You can dispute up to 24 hours after the call. A Vynx resolver decides the split; after 30 days without resolution you can recover the principal.")}</p>
    <fieldset disabled={busy || !!booking} className="mt-4 min-w-0">
      <legend className="text-sm">{t("Time slot (")}{schedule.offer.timezone})</legend>
      <Calendar mode="single" selected={day} defaultMonth={firstDay} disabled={date => busy || !!booking || !availableDays.has(calendarKey(date))} onSelect={date => { setDay(date); setSlot(''); }} classNames={{ root: 'w-full' }} className="mt-2 w-full rounded-xl border border-current/20 bg-transparent p-2 [--cell-size:1.5rem] sm:[--cell-size:2rem]" />
      <label className="mt-3 block text-sm">{t("Select a time slot")}<select value={slot} disabled={busy || !!booking || !daySlots.length} onChange={event => setSlot(event.target.value)} className="mt-2 w-full rounded-lg border border-current/20 bg-transparent p-3"><option value="">{t("Select a time slot")}</option>{daySlots.map(value => <option key={value} value={value}>{new Intl.DateTimeFormat(t.locale, { timeZone: schedule.offer.timezone, timeStyle: 'short' }).format(new Date(value))}</option>)}</select></label>
    </fieldset>
    {!schedule.slots.length && <p className="mt-2 text-sm">{t("No slots are available in the next 14 days.")}</p>}
    <label className="mt-4 flex gap-2 text-sm"><input type="checkbox" checked={accepted} disabled={busy || !!booking} onChange={event => setAccepted(event.target.checked)} />{t("I accept the devnet escrow terms described above.")}</label>
    {booking && <p className="mt-3 text-sm">{t("Booking ")}{booking.id} · {format(booking.starts_at)} · {t(booking.state.replaceAll('_', ' '))}</p>}
    {booking?.state === 'confirmed' && <Link href={`/calls/${booking.id}`} className="mt-4 block rounded-xl border border-violet-400/40 p-4 text-violet-300 underline">{t("Open private call")}</Link>}
    {(!booking || booking.state === 'awaiting_payment') && <button type="button" disabled={busy || (!!session.connectedWallet && !booking && (!slot || !accepted))} onClick={() => void checkout()} style={{ backgroundColor: accent, color: accentInk }} className="mt-4 w-full rounded-xl px-5 py-3 font-semibold transition hover:brightness-110 disabled:opacity-40">{busy ? t('Verifying…') : !session.connectedWallet ? t("Connect wallet to book") : booking ? t('Continue / verify booking') : t('Book and pay into escrow')}</button>}
    {notice && <p role="status" className="mt-4 break-words text-sm">{t(notice)}</p>}
    {(booking?.state === 'confirmed' || booking?.state === 'expired') && <button type="button" disabled={busy} onClick={() => {
      try { localStorage.removeItem(`vynx:booking:v1:${session.wallet}:${alias}`); setBooking(null); setSlot(''); setAccepted(false); setDay(undefined); setNotice(''); }
      catch { setNotice(t("Could not clear this booking reference.")); }
    }} className="mt-3 rounded-lg border border-current/20 px-4 py-2">{t("Choose another booking")}</button>}
    {booking?.signature && <p className="mt-2 break-all text-xs">{t("Signature: ")}{booking.signature}</p>}
  </section>;
}
