import type { AvailabilityWindow } from './call-offer';

type Schedule = { duration_minutes: number; timezone: string; availability: AvailabilityWindow[]; accepting: boolean };
export function callSlots(offer: Schedule, now = Date.now(), days = 14): string[] {
  if (!offer.accepting) return [];
  const format = new Intl.DateTimeFormat('en-US', { timeZone: offer.timezone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const local = (instant: number) => {
    const parts = Object.fromEntries(format.formatToParts(instant).map(part => [part.type, part.value]));
    return { day: `${parts.year}-${parts.month}-${parts.day}`, weekday: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday), minute: Number(parts.hour) * 60 + Number(parts.minute) };
  };
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const slots: string[] = [];
  // Iterate UTC instants, preserving both occurrences of a repeated local time.
  // Reject sessions crossing a DST transition or midnight.
  for (let start = Math.ceil((now + 15 * 60_000) / 60_000) * 60_000; start < now + Math.min(days, 60) * 86_400_000; start += 60_000) {
    const a = local(start);
    if (a.minute % 15) continue;
    const b = local(start + offer.duration_minutes * 60_000);
    if (a.day !== b.day || b.minute - a.minute !== offer.duration_minutes) continue;
    if (offer.availability.some(w => w.weekday === a.weekday && a.minute >= minutes(w.start) && b.minute <= minutes(w.end))) slots.push(new Date(start).toISOString());
  }
  return slots;
}
export function availableCallSlots(slots: string[], duration: number, bookings: { starts_at: string; ends_at: string }[]) {
  return slots.filter(slot => !bookings.some(b => Date.parse(slot) < Date.parse(b.ends_at) && Date.parse(slot) + duration * 60_000 > Date.parse(b.starts_at)));
}
