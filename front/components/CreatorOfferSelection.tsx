"use client";

import Link from "next/link";
import type { KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, Download, Plus, Trash2, Users, Video } from "lucide-react";
import { safeLink, type CreatorOffer } from "@/lib/creator-draft";
import { OFFER_WEEKDAYS, SESSION_DURATIONS, sessionAvailabilityEnd, sessionDurationLabel } from "@/lib/offer-terms";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import WeeklySessionCalendar from "@/components/WeeklySessionCalendar";

const offers = [
  { id: "digital", title: "Digital products", icon: Download },
  { id: "bookings", title: "Bookings and video calls", icon: Video },
  { id: "subscriptions", title: "Subscriptions", icon: Users },
] as const;
const field = "mt-2 w-full border-white/15 bg-black/20 text-white";
function focusNextTime(event: KeyboardEvent<HTMLInputElement>, kind: 'start' | 'end') {
  if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
  const timeInputs = Array.from(event.currentTarget.closest('section')?.querySelectorAll<HTMLInputElement>(`input[data-offer-${kind}-time]`) ?? []);
  const nextInput = timeInputs[timeInputs.indexOf(event.currentTarget) + (event.shiftKey ? -1 : 1)];
  if (nextInput) {
    event.preventDefault();
    nextInput.focus();
  }
}

export default function CreatorOfferSelection({ rows, onChange }: { rows: CreatorOffer[]; onChange: (rows: CreatorOffer[]) => void }) {
  const visibleRows = rows.filter(row => row.type !== 'tickets');
  function update(id: string, change: Partial<CreatorOffer>) {
    onChange(rows.map(row => row.id === id ? { ...row, ...change } : row));
  }
  function move(index: number, offset: number) {
    const reordered = [...rows];
    const from = rows.findIndex(row => row.id === visibleRows[index].id);
    const to = rows.findIndex(row => row.id === visibleRows[index + offset].id);
    [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
    onChange(reordered);
  }
  return <section aria-labelledby="card-offers-title" className="space-y-5">
    <div><h2 id="card-offers-title" className="text-lg font-semibold">Your card offers</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Add up to 8 rows. Set each offer’s details and price. Customers pay through Vynx.</p></div>
    <div className="grid gap-2 sm:grid-cols-2">{offers.map(({ id, title, icon: Icon }) => <Button key={id} type="button" variant="outline" disabled={rows.length >= 8} onClick={() => onChange([...rows, { id: crypto.randomUUID(), type: id, title: "", description: "", price: "", url: "", billingPeriod: id === "subscriptions" ? "month" : "session", ...(id === "bookings" ? { durationMinutes: 30, timezone: "America/Lima", schedule: [] } : {}) }])} className="min-h-11 justify-start whitespace-normal border-white/15 text-left"><Icon size={16} aria-hidden="true" /><span className="flex-1">{title}</span><Plus size={14} aria-hidden="true" /></Button>)}</div>
    {!visibleRows.length && <p className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-zinc-400">Choose an offer type to add your first row.</p>}
    {visibleRows.map((row, index) => <fieldset key={row.id} className="min-w-0 space-y-4 rounded-xl border border-white/10 p-4">
      <legend className="px-2 text-xs text-violet-300">Offer {index + 1} · {offers.find(offer => offer.id === row.type)?.title}</legend>
      <div className="flex justify-end gap-1">
        <Button type="button" variant="ghost" className="size-11" aria-label={`Move up offer ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></Button>
        <Button type="button" variant="ghost" className="size-11" aria-label={`Move down offer ${index + 1}`} disabled={index === visibleRows.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></Button>
        <Button type="button" variant="ghost" className="size-11 text-red-300" aria-label={`Delete offer ${index + 1}`} onClick={() => onChange(rows.filter(item => item.id !== row.id))}><Trash2 size={16} className="text-white" /></Button>
      </div>
      <label className="block text-sm text-zinc-300">Offer title {index + 1}<Input value={row.title} maxLength={60} placeholder="My mentoring session" onChange={event => update(row.id, { title: event.target.value })} className={field} /></label>
      <label className="block text-sm text-zinc-300">Description {index + 1}<Textarea value={row.description} maxLength={280} rows={3} placeholder="What’s included?" onChange={event => update(row.id, { description: event.target.value })} className={field} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-zinc-300">Price {index + 1} (USDC)<Input type="number" min="0" max="9999" step="0.000001" inputMode="decimal" value={row.price} placeholder="25" onKeyDown={event => { if (['e', 'E', '+', '-'].includes(event.key)) event.preventDefault(); }} onChange={event => { const value = event.target.value; if (/^\d{0,4}(?:\.\d{0,6})?$/.test(value)) update(row.id, { price: value }); }} className={field} /></label>
        <label className="block text-sm text-zinc-300">Billing period {index + 1}<select value={row.billingPeriod ?? ''} onChange={event => update(row.id, { billingPeriod: event.target.value as 'session' | 'month' })} className={`${field} min-h-11 rounded-lg border px-3 py-2`}><option value="" disabled>Choose billing period</option><option value="session">Per session</option><option value="month">Per month</option></select></label>
      </div>
      {row.billingPeriod === 'month' && <p className="rounded-lg border border-violet-400/20 bg-violet-400/5 p-3 text-xs leading-5 text-violet-200">Vynx requests a new wallet payment each month. Payments go directly to you in test USDC. The customer reviews and approves every renewal.</p>}
      {row.type === 'bookings' && <>
        <label className="block text-sm text-zinc-300">Session duration {index + 1}<select value={row.durationMinutes ?? 30} onChange={event => update(row.id, { durationMinutes: Number(event.target.value) })} className={`${field} min-h-11 rounded-lg border px-3 py-2`}>{SESSION_DURATIONS.map(duration => <option key={duration} value={duration}>{sessionDurationLabel(duration)}</option>)}</select></label>
        <label className="block text-sm text-zinc-300">Schedule time zone {index + 1}<Input value={row.timezone ?? 'America/Lima'} maxLength={100} placeholder="America/Lima" onChange={event => update(row.id, { timezone: event.target.value })} className={field} /></label>
        <fieldset className="min-w-0 space-y-3 rounded-xl border border-white/10 p-3"><legend className="px-2 text-sm">Weekly session schedule</legend><p className="text-xs leading-5 text-zinc-400">Choose every weekday, start time, and ending available hour. Each weekly session starts at the listed start time, lasts {sessionDurationLabel(row.durationMinutes ?? 30)}, and must finish within your available hours.</p>
          <WeeklySessionCalendar schedule={row.schedule ?? []} offerNumber={index + 1} onChange={schedule => update(row.id, { timezone: row.timezone ?? 'America/Lima', durationMinutes: row.durationMinutes ?? 30, schedule })} />
          {(row.schedule ?? []).map((session, sessionIndex) => <div key={session.id} className="grid min-w-0 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <label className="block min-w-0 text-xs text-zinc-300">Day for offer {index + 1}, session {sessionIndex + 1}<select value={session.weekday} onChange={event => update(row.id, { schedule: (row.schedule ?? []).map(item => item.id === session.id ? { ...item, weekday: Number(event.target.value) } : item) })} className={`${field} min-h-11 rounded-lg border px-3 py-2`}>{OFFER_WEEKDAYS.map((day, weekday) => <option key={day} value={weekday}>{day}</option>)}</select></label>
            <label className="block min-w-0 text-xs text-zinc-300">Starting time<span className="sr-only"> for offer {index + 1}, session {sessionIndex + 1}</span><Input type="time" data-offer-start-time value={session.time} onKeyDown={event => focusNextTime(event, 'start')} onChange={event => update(row.id, { schedule: (row.schedule ?? []).map(item => item.id === session.id ? { ...item, time: event.target.value } : item) })} className={`${field} offer-time-input`} /></label>
            <label className="block min-w-0 text-xs text-zinc-300">Ending hour<span className="sr-only"> for offer {index + 1}, session {sessionIndex + 1}</span><Input type="time" data-offer-end-time onKeyDown={event => focusNextTime(event, 'end')} min={session.time} value={sessionAvailabilityEnd(session, row.durationMinutes ?? 30) === '24:00' ? '' : sessionAvailabilityEnd(session, row.durationMinutes ?? 30)} onChange={event => update(row.id, { schedule: (row.schedule ?? []).map(item => item.id === session.id ? { ...item, endTime: event.target.value } : item) })} className={`${field} offer-time-input`} /></label>
            <Button type="button" variant="ghost" aria-label={`Remove session ${sessionIndex + 1} from offer ${index + 1}`} onClick={() => update(row.id, { schedule: (row.schedule ?? []).filter(item => item.id !== session.id) })} className="min-h-11 self-end text-red-300"><Trash2 size={16} className="text-white" /></Button>
          </div>)}
          <Button type="button" variant="outline" disabled={(row.schedule?.length ?? 0) >= 28} onClick={() => update(row.id, { timezone: row.timezone ?? 'America/Lima', durationMinutes: row.durationMinutes ?? 30, schedule: [...(row.schedule ?? []), { id: crypto.randomUUID(), weekday: 1, time: '09:00', endTime: '17:00' }] })} className="min-h-11 w-full"><Plus size={16} />Add session day and time</Button>
        </fieldset>
      </>}
      <label className="block text-sm text-zinc-300">More details page URL {index + 1} (optional)<Input aria-label={`More details page URL ${index + 1} (optional)`} type="url" value={row.url} maxLength={500} placeholder="https://…" aria-invalid={!!row.url && !safeLink(row.url)} aria-describedby={`offer-url-help-${row.id}`} onChange={event => update(row.id, { url: event.target.value })} className={field} /><span id={`offer-url-help-${row.id}`} className="mt-2 block text-xs text-zinc-400">{row.url && !safeLink(row.url) ? "Use a full URL starting with https://." : "A page with more information about this offer. All payments happen through Vynx."}</span></label>
    </fieldset>)}
    <p className="text-xs leading-5 text-zinc-400">Rows update the preview instantly. Use Save local draft or Save and publish to keep your changes.</p>
    <Link href="/dashboard/monthly" className="inline-flex min-h-11 items-center text-sm text-violet-300">Manage monthly plans and payments ↗</Link>
    <div className="flex flex-wrap gap-4 text-xs text-violet-300"><Link href="/dashboard/bookings" className="inline-flex min-h-11 items-center gap-1">Set up video calls<ArrowUpRight size={14} /></Link><Link href="/dashboard/products" className="inline-flex min-h-11 items-center gap-1">View product setup<ArrowUpRight size={14} /></Link></div>
  </section>;
}
