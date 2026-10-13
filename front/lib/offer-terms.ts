import { UserFacingError } from './user-facing-error';

export const SESSION_DURATIONS = [30, 60, 90, 120, 180] as const;
export const OFFER_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export type OfferSession = { id: string; weekday: number; time: string; endTime?: string };
export type OfferTerms = { billingPeriod?: 'session' | 'month'; durationMinutes?: number; timezone?: string; schedule?: OfferSession[] };
export function sessionDurationLabel(minutes: number) {
  return minutes === 30 ? '30 min' : `${minutes / 60} ${minutes === 60 ? 'hour' : 'hours'}`;
}
export function sessionAvailabilityEnd(session: OfferSession, durationMinutes = 30) {
  if (session.endTime !== undefined) return session.endTime;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(session.time)) return '';
  const end = Number(session.time.slice(0, 2)) * 60 + Number(session.time.slice(3)) + durationMinutes;
  if (end > 1440) return '';
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}
export function sessionAvailabilityLabel(session: OfferSession, durationMinutes = 30) {
  return `${OFFER_WEEKDAYS[session.weekday]} ${session.time}–${sessionAvailabilityEnd(session, durationMinutes)}`;
}
export function readOfferTerms(value: OfferTerms): OfferTerms {
  const invalid = () => { throw new UserFacingError('Check the offer billing period, session duration, time zone, and weekly schedule.'); };
  if (value.billingPeriod !== undefined && !['session', 'month'].includes(value.billingPeriod)) invalid();
  if (value.durationMinutes !== undefined && !(SESSION_DURATIONS as readonly number[]).includes(value.durationMinutes)) invalid();
  if (value.timezone !== undefined) {
    if (typeof value.timezone !== 'string' || value.timezone.length > 100) invalid();
    try { new Intl.DateTimeFormat('en', { timeZone: value.timezone }); } catch { invalid(); }
  }
  if (value.schedule !== undefined && (!Array.isArray(value.schedule) || value.schedule.length > 28)) invalid();
  const schedule = (value.schedule ?? []).map(session => {
    if (!session || typeof session.id !== 'string' || session.id.length > 60 || !session.id || !Number.isInteger(session.weekday) || session.weekday < 0 || session.weekday > 6 || typeof session.time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(session.time)) invalid();
    if (session.endTime !== undefined && (typeof session.endTime !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(session.endTime))) invalid();
    return { id: session.id, weekday: session.weekday, time: session.time, ...(session.endTime !== undefined ? { endTime: session.endTime } : {}) };
  });
  if (new Set(schedule.map(session => session.id)).size !== schedule.length) invalid();
  const duration = value.durationMinutes ?? 30;
  const ordered = [...schedule].sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time));
  for (let i = 0; i < ordered.length; i++) {
    const start = Number(ordered[i].time.slice(0, 2)) * 60 + Number(ordered[i].time.slice(3));
    if (start + duration > 1440) invalid();
    if (ordered[i].endTime !== undefined) {
      const end = ordered[i].endTime!;
      const availableUntil = Number(end.slice(0, 2)) * 60 + Number(end.slice(3));
      if (availableUntil < start + duration) throw new UserFacingError('The ending available hour must be after the start time and allow the full session duration.');
    }
    if (i && ordered[i - 1].weekday === ordered[i].weekday) {
      const previous = Number(ordered[i - 1].time.slice(0, 2)) * 60 + Number(ordered[i - 1].time.slice(3));
      if (start < previous + duration) invalid();
    }
  }
  return {
    ...(value.billingPeriod !== undefined ? { billingPeriod: value.billingPeriod } : {}),
    ...(value.durationMinutes !== undefined ? { durationMinutes: value.durationMinutes } : {}),
    ...(value.timezone !== undefined ? { timezone: value.timezone } : {}),
    ...(value.schedule !== undefined ? { schedule } : {}),
  };
}
