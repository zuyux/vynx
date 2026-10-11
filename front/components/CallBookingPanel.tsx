'use client';

import Link from 'next/link';

import { useEffect, useRef, useState } from 'react';
import { Transaction } from '@solana/web3.js';
import { useWalletSession } from './WalletSessionProvider';
import { sendDevnetTransaction } from '@/lib/devnet-wallet';
import { confirmPayment } from '@/lib/payment-client';
import { UserFacingError, responseError, userErrorMessage } from '@/lib/user-facing-error';
import { callPrice, type CallOffer } from '@/lib/call-offer';

type Booking = { id: string; state: string; starts_at: string; signature: string | null; terms: { title: string; timezone: string; duration_minutes?: number }; price_units: number };
type Recovery = { id: string; signature?: string; sending?: boolean };
async function post(body: unknown) {
  const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw responseError(response, result, 'No se pudo completar la reserva.');
  return result;
}
export default function CallBookingPanel({ alias }: { alias: string }) {
  const session = useWalletSession();
  const [schedule, setSchedule] = useState<{ offer: CallOffer; slots: string[] } | null>(null);
  const [slot, setSlot] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [manualSignature, setManualSignature] = useState('');
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
      if (!controller.signal.aborted) { setBooking(result.booking); setManualSignature(recovery.signature ?? ''); }
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
      if (!response.ok) throw responseError(response, status, 'No se pudo recuperar la reserva.');
      setBooking(status.booking);
      if (status.booking.state === 'confirmed') { setNotice('Reserva confirmada. El depósito de escrow fue verificado.'); return; }
      if (recovery.signature || manualSignature.trim()) {
        const signature = recovery.signature ?? manualSignature.trim();
        const result = await confirmPayment(() => post({ action: 'confirm', id: recovery!.id, signature }));
        setBooking(result.booking); setNotice('Reserva confirmada. El depósito de escrow fue verificado.');
        localStorage.setItem(key, JSON.stringify({ id: recovery.id, signature }));
        return;
      }
      if (recovery.sending) throw new UserFacingError('El resultado del envío es incierto. Recupera la firma en Phantom y verifica el pago antes de volver a enviar.');
      const result = await post({ action: 'checkout', id: recovery.id });
      if (result.booking.state === 'confirmed') { setBooking(result.booking); return; }
      const transaction = Transaction.from(Uint8Array.from(atob(result.transaction), c => c.charCodeAt(0)));
      // Persist before opening the wallet; never clear this on an ambiguous error.
      localStorage.setItem(key, JSON.stringify({ ...recovery, sending: true }));
      const { signature } = await sendDevnetTransaction(transaction, wallet);
      recovery = { id: recovery.id, signature, sending: true };
      localStorage.setItem(key, JSON.stringify(recovery));
      setManualSignature(signature);
      const confirmed = await confirmPayment(() => post({ action: 'confirm', id: recovery!.id, signature }));
      setBooking(confirmed.booking); setNotice('Reserva confirmada. El depósito de escrow fue verificado.');
    } catch (reason) { setNotice(userErrorMessage(reason, 'No se pudo completar la reserva. Conserva la firma y reintenta la verificación.')); }
    finally { inFlight.current = false; setBusy(false); }
  }
  if (!schedule) return null;
  const format = (instant: string) => new Intl.DateTimeFormat('es', { timeZone: booking?.terms.timezone ?? schedule.offer.timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(instant));
  return <section className="mt-6 rounded-2xl border border-current/15 p-6">
    <h2 className="text-xl font-semibold">Reservar una llamada</h2>
    <p className="mt-2">{booking?.terms.title ?? schedule.offer.title} · {booking?.terms.duration_minutes ?? schedule.offer.duration_minutes} min · {booking ? callPrice(booking.price_units) : schedule.offer.price} USDC</p>
    <p className="mt-2 text-sm opacity-70">Solana devnet · tokens de prueba · escrow personalizado sin auditoría. Tu wallet paga el depósito de las cuentas y la comisión de red.</p>
    <p className="mt-3 text-sm">Los fondos quedan retenidos hasta la resolución. Reembolso completo si el creador cancela o cancelas con 24 horas de anticipación. Puedes disputar hasta 24 horas después de la llamada. Un resolver de Vynx decide el reparto; tras 30 días sin resolución puedes recuperar el principal.</p>
    <label className="mt-4 block text-sm">Horario ({schedule.offer.timezone})<select value={slot} disabled={busy || !!booking} onChange={event => setSlot(event.target.value)} className="mt-2 w-full rounded-lg border border-current/20 bg-transparent p-3"><option value="">Selecciona un horario</option>{schedule.slots.map(value => <option key={value} value={value}>{format(value)} · {value}</option>)}</select></label>
    {!schedule.slots.length && <p className="mt-2 text-sm">No hay horarios disponibles en los próximos 14 días.</p>}
    <label className="mt-4 flex gap-2 text-sm"><input type="checkbox" checked={accepted} disabled={busy || !!booking} onChange={event => setAccepted(event.target.checked)} />Acepto los términos de escrow devnet descritos arriba.</label>
    {booking && <p className="mt-3 text-sm">Reserva {booking.id} · {format(booking.starts_at)} · {booking.state === 'confirmed' ? 'Confirmada' : booking.state === 'expired' ? 'Expirada' : 'Pendiente de pago'}</p>}
    {booking?.state === 'confirmed' && <Link href={`/calls/${booking.id}`} className="mt-4 block rounded-xl border border-violet-400/40 p-4 text-violet-300 underline">Abrir llamada privada</Link>}
    {booking?.state !== 'confirmed' && <><label className="mt-4 block text-sm">Firma para recuperar un pago enviado (opcional)<input value={manualSignature} onChange={event => setManualSignature(event.target.value)} disabled={busy} className="mt-2 w-full rounded-lg border border-current/20 bg-transparent p-3" /></label><button type="button" disabled={busy || (!!session.connectedWallet && !booking && (!slot || !accepted))} onClick={() => void checkout()} className="mt-4 rounded-xl bg-violet-400 px-5 py-3 font-semibold text-black disabled:opacity-40">{busy ? 'Verificando…' : !session.connectedWallet ? 'Conectar wallet para reservar' : booking ? 'Continuar / verificar reserva' : 'Reservar y pagar en escrow'}</button></>}
    {notice && <p role="status" className="mt-4 break-words text-sm">{notice}</p>}
    {(booking?.state === 'confirmed' || booking?.state === 'expired') && <button type="button" disabled={busy} onClick={() => {
      try { localStorage.removeItem(`vynx:booking:v1:${session.wallet}:${alias}`); setBooking(null); setSlot(''); setAccepted(false); setManualSignature(''); setNotice(''); }
      catch { setNotice('No se pudo limpiar la referencia de esta reserva.'); }
    }} className="mt-3 rounded-lg border border-current/20 px-4 py-2">Elegir otra reserva</button>}
    {booking?.signature && <p className="mt-2 break-all text-xs">Firma: {booking.signature}</p>}
  </section>;
}
