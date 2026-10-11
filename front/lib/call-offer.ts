import { UserFacingError } from './user-facing-error';

export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export type AvailabilityWindow = { weekday: number; start: string; end: string };
export type CallOfferInput = { title: string; description: string; duration_minutes: number; price: string; timezone: string; availability: AvailabilityWindow[]; accepting: boolean };
export type CallOffer = CallOfferInput & { id: string; currency: 'USDC'; cluster: 'devnet'; updated_at: string };
export const EMPTY_CALL_OFFER: CallOfferInput = { title: '', description: '', duration_minutes: 30, price: '10', timezone: 'America/Lima', availability: [], accepting: false };
const invalid = (message: string): never => { throw new UserFacingError(message); };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function callPriceUnits(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{1,4}(?:\.\d{1,6})?$/.test(value)) return invalid('Usa un precio entre 0.01 y 1000 USDC, con hasta 6 decimales.');
  const [whole, fraction = ''] = value.split('.');
  const units = Number(whole) * 1_000_000 + Number(fraction.padEnd(6, '0'));
  if (units < 10_000 || units > 1_000_000_000) return invalid('Usa un precio entre 0.01 y 1000 USDC.');
  return units;
}
export function callPrice(units: number): string {
  return `${Math.floor(units / 1_000_000)}.${String(units % 1_000_000).padStart(6, '0')}`.replace(/\.?0+$/, '');
}
function minute(value: unknown): number {
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return invalid('Usa horarios válidos en formato de 24 horas.');
  const [hours, minutes] = value.split(':').map(Number);
  if (minutes % 15) return invalid('Define tus horarios en intervalos de 15 minutos.');
  return hours * 60 + minutes;
}
export function callOfferFields(value: unknown) {
  if (!object(value)) return invalid('Completa los datos del servicio.');
  const { title, description, duration_minutes: duration, timezone, accepting, availability } = value;
  if (typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 100) return invalid('El nombre del servicio debe tener entre 3 y 100 caracteres.');
  if (typeof description !== 'string' || description.trim().length < 10 || description.trim().length > 2000) return invalid('Describe el servicio en 10 a 2000 caracteres.');
  if (typeof duration !== 'number' || !Number.isInteger(duration) || duration < 15 || duration > 240 || duration % 15) return invalid('Usa una duración de 15 a 240 minutos, en intervalos de 15 minutos.');
  if (typeof timezone !== 'string' || timezone.length > 100 || !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)*$/.test(timezone)) return invalid('Elige una zona horaria IANA válida, por ejemplo America/Lima.');
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { return invalid('Elige una zona horaria IANA válida, por ejemplo America/Lima.'); }
  if (typeof accepting !== 'boolean' || !Array.isArray(availability) || availability.length > 28) return invalid('Define hasta 28 franjas semanales y el estado del servicio.');
  if (accepting && !availability.length) return invalid('Agrega al menos una franja antes de activar la disponibilidad.');
  const windows = availability.map(window => {
    if (!object(window) || typeof window.weekday !== 'number' || !Number.isInteger(window.weekday) || window.weekday < 0 || window.weekday > 6) return invalid('Selecciona un día de la semana válido.');
    const start = minute(window.start), end = minute(window.end);
    if (end - start < duration) return invalid('Cada franja debe permitir al menos una sesión completa y terminar el mismo día.');
    return { weekday: window.weekday, start: window.start as string, end: window.end as string };
  }).sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
  for (let i = 1; i < windows.length; i++) {
    if (windows[i].weekday === windows[i - 1].weekday && windows[i].start < windows[i - 1].end) return invalid('Las franjas del mismo día no pueden superponerse.');
  }
  return { title: title.trim(), description: description.trim(), duration_minutes: duration, price_units: callPriceUnits(value.price), currency: 'USDC' as const, cluster: 'devnet' as const, timezone, availability: windows, accepting };
}
export const CALL_OFFER_COLUMNS = 'id,title,description,duration_minutes,price_units,currency,cluster,timezone,availability,accepting,updated_at';
export function callOfferResponse(row: ReturnType<typeof callOfferFields> & { id: string; updated_at: string }): CallOffer {
  return { id: row.id, title: row.title, description: row.description, duration_minutes: row.duration_minutes, price: callPrice(Number(row.price_units)), currency: row.currency, cluster: row.cluster, timezone: row.timezone, availability: row.availability, accepting: row.accepting, updated_at: row.updated_at };
}
