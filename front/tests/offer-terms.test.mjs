import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_DRAFT, publicationFields, readDraft, validateDraft } from '../lib/creator-draft.ts';
import { readOfferTerms, SESSION_DURATIONS, sessionAvailabilityEnd, sessionAvailabilityLabel, sessionDurationLabel } from '../lib/offer-terms.ts';

const offer = { id: 'one', type: 'bookings', title: 'Coaching', description: 'Weekly coaching', price: '40', url: 'https://example.com', billingPeriod: 'month', durationMinutes: 60, timezone: 'America/Lima', schedule: [{ id: 'monday', weekday: 1, time: '09:00' }, { id: 'friday', weekday: 5, time: '15:00' }] };
const draft = { ...EMPTY_DRAFT, alias: 'coach', name: 'Coach', offers: [offer] };
test('monthly billing, duration and all weekly sessions survive publication and reload', () => {
  assert.deepEqual(readDraft(JSON.stringify(publicationFields(draft))).offers, [{ ...offer, url: 'https://example.com/' }]);
  for (const durationMinutes of SESSION_DURATIONS) assert.equal(readOfferTerms({ ...offer, durationMinutes }).durationMinutes, durationMinutes);
  assert.equal(sessionDurationLabel(90), '1.5 hours');
});
test('invalid billing, duration, time zones and overlapping weekly sessions are rejected', () => {
  for (const patch of [{ billingPeriod: 'year' }, { durationMinutes: 45 }, { timezone: 'Mars/Olympus' }, { schedule: [{ id: 'bad', weekday: 7, time: '09:00' }] }, { schedule: [{ id: 'bad', weekday: 1, time: '24:00' }] }, { schedule: [{ id: 'bad', weekday: 1, time: '23:30' }] }, { schedule: [offer.schedule[0], { id: 'overlap', weekday: 1, time: '09:30' }] }, { schedule: [offer.schedule[0], offer.schedule[0]] }]) assert.throws(() => readOfferTerms({ ...offer, ...patch }));
  assert.doesNotThrow(() => readOfferTerms({ ...offer, schedule: [offer.schedule[0], { id: 'adjacent', weekday: 1, time: '10:00' }] }));
});
test('monthly bookings require a full schedule and structured pricing requires numeric USDC', () => {
  for (const patch of [{ schedule: [] }, { timezone: undefined }, { durationMinutes: undefined }, { price: '40 USDC / month' }, { price: '-1' }, { price: '1e2' }]) assert.throws(() => publicationFields({ ...draft, offers: [{ ...offer, ...patch }] }));
  const legacy = { id: 'legacy', type: 'digital', title: 'Guide', description: '', price: 'Free', url: 'https://example.com' };
  assert.throws(() => publicationFields({ ...draft, offers: [legacy] }));
  for (const price of ['0', '25', '25.5']) assert.equal(publicationFields({ ...draft, offers: [{ ...legacy, price }] }).offers[0].price, price);
});

test('local draft saves reject overlapping sessions before overwriting browser storage', () => {
  const overlapping = { ...draft, offers: [{ ...offer, schedule: [offer.schedule[0], { id: 'overlap', weekday: 1, time: '09:30' }] }] };
  assert.match(validateDraft(overlapping), /weekly schedule/);
});

test('availability end hours persist and sessions must fit fully inside the available window', () => {
  const window = { ...offer.schedule[0], endTime: '17:00' };
  const saved = publicationFields({ ...draft, offers: [{ ...offer, schedule: [window] }] });
  assert.deepEqual(readDraft(JSON.stringify(saved)).offers[0].schedule, [window]);
  assert.equal(sessionAvailabilityLabel(window, 60), 'Monday 09:00–17:00');
  assert.equal(sessionAvailabilityEnd(offer.schedule[0], 60), '10:00');
  assert.equal('endTime' in readOfferTerms(offer).schedule[0], false);
  for (const endTime of ['', '08:00', '09:00', '09:59', '24:00', '17:60', null, 1700]) {
    assert.throws(() => readOfferTerms({ ...offer, schedule: [{ ...window, endTime }] }));
  }
  assert.doesNotThrow(() => readOfferTerms({ ...offer, schedule: [{ ...window, endTime: '10:00' }] }));
  assert.throws(() => readOfferTerms({ ...offer, durationMinutes: 180, schedule: [{ ...window, endTime: '11:59' }] }));
  assert.doesNotThrow(() => readOfferTerms({ ...offer, durationMinutes: 180, schedule: [{ ...window, endTime: '12:00' }] }));
});
