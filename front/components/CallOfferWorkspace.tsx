'use client';

import Link from 'next/link';
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
      if (await session.ensureSession() !== owner) throw new UserFacingError('Tu wallet cambió. Recarga el servicio antes de guardar.');
      const response = await fetch('/api/call-offer', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
      const result = await response.json();
      if (!response.ok) throw responseError(response, result, 'No se pudo guardar tu servicio. Tu borrador se conserva.');
      setDraft(result.offer); onSaved(result.offer);
      setNotice('Servicio guardado en tu cuenta.');
    } catch (reason) { setFailed(true); setNotice(userErrorMessage(reason, 'No se pudo guardar tu servicio. Tu borrador se conserva.')); }
    finally { setBusy(false); }
  }
  return <form onSubmit={event => void save(event)} className="mt-7 space-y-6">
    <fieldset disabled={busy} className="min-w-0 space-y-6 disabled:opacity-60"><legend className="sr-only">Configurar servicio de videollamada</legend>
      <label className="block text-sm text-zinc-300">Nombre del servicio<input name="title" required minLength={3} maxLength={100} value={draft.title} onChange={event => change('title', event.target.value)} placeholder="Mentoría de diseño" className={input} /></label>
      <label className="block text-sm text-zinc-300">Qué incluye el servicio<textarea name="description" required minLength={10} maxLength={2000} rows={4} value={draft.description} onChange={event => change('description', event.target.value)} placeholder="Explica qué trabajarán juntos y qué recibirá la persona al terminar." className={`${input} resize-y`} /></label>
      <div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm text-zinc-300">Duración (minutos)<input name="duration_minutes" type="number" required min={15} max={240} step={15} value={draft.duration_minutes} onChange={event => change('duration_minutes', Number(event.target.value))} className={input} /></label>
      <label className="block text-sm text-zinc-300">Precio (USDC de prueba)<input name="price" type="number" required min="0.01" max="1000" step="0.000001" value={draft.price} onChange={event => change('price', event.target.value)} className={input} /><span className="mt-2 block text-xs leading-5 text-zinc-400">De 0.01 a 1000 USDC por sesión. Solana devnet; tokens sin valor monetario.</span></label></div>
      <label className="block text-sm text-zinc-300">Zona horaria de las reservas<input name="timezone" required list="booking-timezones" value={draft.timezone} onChange={event => change('timezone', event.target.value)} className={input} aria-describedby="timezone-help" /><datalist id="booking-timezones">{zones.map(zone => <option key={zone} value={zone} />)}</datalist><span id="timezone-help" className="mt-2 block text-xs leading-6 text-zinc-400">Usa una zona IANA como America/Lima o Europe/Madrid. Todos los horarios siguientes son locales a esta zona; las zonas con horario de verano conservan la hora local.</span></label>
      <fieldset className="min-w-0 rounded-2xl border border-white/15 p-4"><legend className="px-2 text-sm font-semibold">Disponibilidad semanal</legend><p className="mb-4 text-xs leading-6 text-zinc-400">Agrega franjas en intervalos de 15 minutos. Cada franja debe caber en el mismo día y permitir una sesión completa. No se permiten solapamientos.</p>
        {!draft.availability.length && <p className="mb-4 text-sm text-zinc-300">Todavía no has definido horarios.</p>}
        <div className="space-y-4">{draft.availability.map((window, index) => <div key={index} className="grid min-w-0 gap-3 rounded-xl border border-white/10 p-3 sm:grid-cols-2">
          <label className="block text-xs text-zinc-300">Día de la franja {index + 1}<select value={window.weekday} onChange={event => change('availability', draft.availability.map((item, i) => i === index ? { ...item, weekday: Number(event.target.value) } : item))} className={input}>{WEEKDAYS.map((day, value) => <option key={day} value={value}>{day}</option>)}</select></label>
          <div className="grid min-w-0 grid-cols-2 gap-3">{(['start', 'end'] as const).map(key => <label key={key} className="block min-w-0 text-xs text-zinc-300">{key === 'start' ? 'Inicio' : 'Fin'} de la franja {index + 1}<input type="time" required step={900} value={window[key]} onChange={event => change('availability', draft.availability.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item))} className={input} /></label>)}</div>
          <button type="button" onClick={() => change('availability', draft.availability.filter((_, i) => i !== index))} className={`${button} sm:col-span-2`} aria-label={`Eliminar franja ${index + 1}`}>Eliminar franja</button>
        </div>)}</div>
        <button type="button" disabled={draft.availability.length >= 28} onClick={() => change('availability', [...draft.availability, { weekday: 1, start: '09:00', end: '12:00' }])} className={`${button} mt-4 w-full`}>Agregar franja semanal</button>
      </fieldset>
      <label className="flex items-start gap-3 text-sm text-zinc-300"><input name="accepting" type="checkbox" checked={draft.accepting} onChange={event => change('accepting', event.target.checked)} className="mt-1 size-4 shrink-0 accent-violet-400" /><span>Activar disponibilidad del servicio<span className="mt-1 block text-xs leading-6 text-zinc-400">Al pausarla, conservas la configuración y los horarios guardados.</span></span></label>
      <button className="min-h-12 w-full rounded-xl bg-violet-400 px-5 py-3 font-semibold text-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400">{busy ? 'Guardando…' : 'Guardar servicio'}</button>
    </fieldset>
    {notice && <p role={failed ? 'alert' : 'status'} className={`rounded-xl border p-4 text-sm ${failed ? 'border-red-400/40 text-red-300' : 'border-emerald-400/30 text-emerald-300'}`}>{notice}</p>}
  </form>;
}

export default function CallOfferWorkspace() {
  const { wallet } = useWalletSession();
  const [snapshot, setSnapshot] = useState<{ wallet: string; offer: CallOffer | null; error: string } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!wallet) return;
    const controller = new AbortController();
    fetch('/api/call-offer', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw responseError(response, result, 'No se pudo cargar tu servicio.');
      if (!controller.signal.aborted) setSnapshot({ wallet, offer: result.offer, error: '' });
    }).catch(reason => { if (!controller.signal.aborted) setSnapshot({ wallet, offer: null, error: userErrorMessage(reason, 'No se pudo cargar tu servicio.') }); });
    return () => controller.abort();
  }, [wallet, retry]);
  const loaded = snapshot?.wallet === wallet ? snapshot : null;
  return <div className="min-h-screen bg-[#08080b] text-white"><Sidebar /><main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:ml-64 lg:px-12">
    <Link href="/dashboard/card" className="text-sm text-violet-300 underline">Volver a Mi página</Link>
    <h1 className="mt-5 text-3xl font-semibold">Mi servicio de videollamada</h1><p className="mt-3 text-sm leading-7 text-zinc-300">Define tu servicio, duración, precio y horarios. Puedes guardar un servicio por wallet y actualizarlo cuando quieras.</p>
    <p className="mt-5 rounded-xl border border-violet-400/30 bg-violet-400/10 p-4 text-sm leading-7 text-violet-200">Tu configuración se guarda en tu cuenta. La selección de turnos, las reservas, los enlaces de llamada y el cobro de sesiones todavía no están disponibles.</p>
    {!loaded ? <LoadingState label="Cargando tu servicio…" /> : loaded.error ? <div className="mt-6"><p role="alert" className="text-red-300">{loaded.error}</p><button onClick={() => { setSnapshot(null); setRetry(value => value + 1); }} className={`${button} mt-4`}>Reintentar carga</button></div> : <OfferEditor key={wallet} owner={wallet} offer={loaded.offer} onSaved={offer => setSnapshot({ wallet, offer, error: '' })} />}
  </main></div>;
}
