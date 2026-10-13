export const DEMO_BOOKING_POLICY = 'vynx-demo-booking-v1';
export const DEMO_CALL_OFFER = {
  id: 'luna-creative-session', title: 'Creative session', duration_minutes: 30,
  timezone: 'America/Argentina/Buenos_Aires', price_units: 35000000, currency: 'USDC',
  accepting: true, availability: Array.from({ length: 7 }, (_, weekday) => ({ weekday, start: '15:00', end: '18:00' })),
};
