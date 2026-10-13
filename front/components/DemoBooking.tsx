'use client';
import { useEffect, useRef, useState } from 'react';
import { DEMO_BOOKING_POLICY, DEMO_CALL_OFFER } from '@/lib/demo-booking';
import styles from '@/app/dashboard/studio/studio.module.css';

type Booking = { id: string; starts_at: string; ends_at: string; terms: { viewer_timezone: string } };
export function DemoBooking() {
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Loading demo availability…');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [timezone, setTimezone] = useState(DEMO_CALL_OFFER.timezone);
  const attempt = useRef<{ slot: string; timezone: string; request_id: string } | null>(null);
  useEffect(() => {
    let active = true;
    fetch('/api/demo/bookings').then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (active) { setSlots(data.slots); setMessage(data.slots.length ? '' : 'No demo slots available.'); }
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, []);
  async function reserve() {
    setBusy(true); setMessage('');
    if (attempt.current?.slot !== slot || attempt.current?.timezone !== timezone) attempt.current = { slot, timezone, request_id: crypto.randomUUID() };
    try {
      const response = await fetch('/api/demo/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...attempt.current, accepted_policy: DEMO_BOOKING_POLICY }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setBooking(data.booking); setMessage('Demo reservation saved. No payment was made.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not reserve. Retry with the same selection.'); }
    finally { setBusy(false); }
  }
  const format = (instant: string, zone = timezone) => new Intl.DateTimeFormat('en', { timeZone: zone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(instant));
  return <section className={styles.panel}><h3>Book your creative session</h3><p>30 minutes with Luna Studio · illustrative price 35 USDC</p><p>Demo reservations are saved. Sign in to reserve; no funds move.</p>
    <label>Display timezone<select value={timezone} disabled={busy} onChange={event => { setTimezone(event.target.value); setAccepted(false); }}>
      {['America/Argentina/Buenos_Aires','America/Lima','America/New_York','Europe/London','UTC'].map(zone => <option key={zone}>{zone}</option>)}
    </select></label>
    <label>Available session<select value={slot} disabled={busy} onChange={event => { setSlot(event.target.value); setAccepted(false); }}><option value="">Choose a slot</option>{slots.map(value => <option key={value} value={value}>{format(value)}</option>)}</select></label>
    <label><input type="checkbox" checked={accepted} disabled={busy} onChange={event => setAccepted(event.target.checked)}/> I accept a 30-minute demo reservation in {timezone}. This is a simulation with no charge or live call.</label>
    <button className={styles.primary} disabled={!slot || !accepted || busy} onClick={reserve}>{busy ? 'Reserving…' : 'Reserve demo slot'}</button>
    {message && <p role="status">{message}</p>}
    {booking && <div className={styles.receipt}><span>Reservation</span><strong>{booking.id}</strong><span>Accepted time</span><strong>{format(booking.starts_at, booking.terms.viewer_timezone)} · {booking.terms.viewer_timezone}</strong></div>}
  </section>;
}
