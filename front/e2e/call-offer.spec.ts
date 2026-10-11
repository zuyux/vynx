import { test, expect } from './test';
import { createClient } from '@supabase/supabase-js';
import { installWallet, signIn } from './wallet';

test('creator service persists and rejects invalid or unauthorized changes', async ({ context, page, playwright }) => {
  const owner = await installWallet(context);
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
  const wallet = owner.publicKey.toBase58();
  const seed = await db.from('cards_users').insert({ wallet_address: wallet, username: `call_${Date.now()}` });
  expect(seed.error).toBeNull();
  await signIn(page, '/dashboard/bookings');
  await page.getByLabel('Nombre del servicio').fill('Mentoría de diseño');
  await page.getByLabel('Qué incluye el servicio').fill('Revisión de tu portfolio y recomendaciones concretas.');
  await page.getByLabel('Precio (USDC de prueba)').fill('12.000001');
  await page.getByLabel('Zona horaria de las reservas').fill('America/New_York');
  await page.getByRole('button', { name: 'Agregar franja semanal' }).click();
  await page.getByLabel('Activar disponibilidad del servicio').check();
  await page.getByRole('button', { name: 'Guardar servicio', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Servicio guardado en tu cuenta.');
  await page.reload();
  await expect(page.getByLabel('Nombre del servicio')).toHaveValue('Mentoría de diseño');
  await expect(page.getByLabel('Precio (USDC de prueba)')).toHaveValue('12.000001');
  await expect(page.getByLabel('Zona horaria de las reservas')).toHaveValue('America/New_York');
  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const offer = (await (await page.request.get('/api/call-offer')).json()).offer;
  expect(offer.creator_wallet).toBeUndefined();
  const invalid = await page.request.put('/api/call-offer', { headers: { Origin: process.env.E2E_BASE_URL! }, data: { ...offer, availability: [...offer.availability, ...offer.availability] } });
  expect(invalid.status()).toBe(400);
  expect((await (await page.request.get('/api/call-offer')).json()).offer).toEqual(offer);
  const crossOrigin = await page.request.put('/api/call-offer', { headers: { Origin: 'https://untrusted.example' }, data: offer });
  expect(crossOrigin.status()).toBe(403);
  const anonymous = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL });
  expect((await anonymous.get('/api/call-offer')).status()).toBe(401);
  await anonymous.dispose();
});
