import type { Page } from '@playwright/test';
import { test, expect } from './test';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
import bs58 from 'bs58';
import { Keypair, Transaction } from '@solana/web3.js';
import { installWallet, signIn } from './wallet';
const origin = process.env.E2E_BASE_URL!;
const db = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
const control = (body: unknown) => fetch(`${process.env.E2E_FIXTURE_URL}/test/registry`, { method: 'POST', body: JSON.stringify(body) });
async function prepare(page: Page, owner: Keypair, alias: string) {
  const quote = await (await page.request.get(`/api/actions/claim-alias?alias=${alias}`)).json();
  const response = await page.request.post(`/api/actions/claim-alias?alias=${alias}`, { headers: { origin }, data: { account: owner.publicKey.toBase58(), priceLamports: quote.priceLamports, priceVersion: quote.priceVersion } });
  expect(response.status()).toBe(200);
  return response.json();
}
async function submit(payment: { transaction: string }, owner: Keypair) {
  const tx = Transaction.from(Buffer.from(payment.transaction, 'base64')); tx.partialSign(owner);
  const response = await fetch(`${process.env.E2E_FIXTURE_URL}/test/submit`, { method: 'POST', body: JSON.stringify({ transaction: tx.serialize().toString('base64') }) });
  expect(response.ok).toBe(true); return response.json();
}
const confirm = (page: Page, owner: Keypair, alias: string, signature: string) => page.request.post(`/api/actions/claim-alias/confirm?alias=${alias}`, { headers: { origin }, data: { account: owner.publicKey.toBase58(), signature } });

test('browser registers a one-character alias with sponsorship, publishes and recovers confirmation', async ({ browser }, testInfo) => {
  // Separate names for projects sharing the same isolated chain fixture.
  const alias = 'pqrst'[testInfo.config.projects.findIndex(project => project.name === testInfo.project.name)] || 'q';
  const context = await browser.newContext(); const owner = await installWallet(context); const page = await context.newPage();
  await signIn(page, '/dashboard/card'); await expect(page).toHaveURL(/profile\/buy-alias/);
  await page.getByLabel('Alias', { exact: true }).fill(alias);
  await expect(page.getByRole('button', { name: 'Claim alias — 0.92 SOL' })).toBeEnabled();
  await expect(page.getByText(/VYNX pays network fees/)).toBeVisible();
  await page.getByRole('button', { name: 'Claim alias — 0.92 SOL' }).click();
  await expect(page).toHaveURL(/dashboard\/card/);
  await page.getByLabel('Nombre de creador').fill('Registry creator');
  await page.getByRole('button', { name: 'Guardar y publicar', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /Diseño publicado/ })).toBeVisible();
  const { data, error } = await db().from('cards_users').select('*').eq('wallet_address', owner.publicKey.toBase58()).single();
  expect(error).toBeNull(); expect(data.claim_lamports).toBe(920000000); expect(data.claim_program).toBe('AxQxAgndT6ziUr3FBNafhJzF4PpniGpMX4fVRXXmh5y8'); expect(data.claim_alias_pda).toBeTruthy(); expect(data.claim_owner_pda).toBeTruthy();
  expect((await confirm(page, owner, alias, data.tx_signature)).status()).toBe(200);
  await page.goto(`/${alias}`); await expect(page.getByRole('heading', { name: 'Registry creator' })).toBeVisible();
  await context.close();
});

test('1–30 character pricing, concurrent preparation, 30-character registration and PDA forgery rejection', async ({ browser, request }) => {
  for (const [alias, price] of [['z', '0.92'], ['zx', '0.53'], ['zxy', '0.3'], ['zxyw', '0.14'], ['x'.repeat(5), '0.01'], ['x'.repeat(12), '0.01'], ['x'.repeat(30), '0.01']]) {
    const response = await request.get(`/api/actions/claim-alias?alias=${alias}`); expect(response.status()).toBe(200); expect((await response.json()).priceSol).toBe(price);
  }
  expect((await request.get(`/api/actions/claim-alias?alias=${'x'.repeat(31)}`)).status()).toBe(400);
  const context = await browser.newContext(); const owner = await installWallet(context); const page = await context.newPage(); await signIn(page); await expect(page).toHaveURL(/profile\/buy-alias/);
  const alias = 'r'.repeat(30);
  const payments = await Promise.all(Array.from({ length: 4 }, () => prepare(page, owner, alias)));
  expect(new Set(payments.map(p => p.signature)).size).toBe(1);
  const tx = Transaction.from(Buffer.from(payments[0].transaction, 'base64'));
  expect(tx.feePayer?.equals(owner.publicKey)).toBe(false); expect(tx.signatures.filter(s => s.signature)).toHaveLength(1);
  const sent = await submit(payments[0], owner); expect(sent.signature).toBe(payments[0].signature);
  expect((await confirm(page, owner, alias, sent.signature)).status()).toBe(200);
  const row = await db().from('cards_users').select('*').eq('wallet_address', owner.publicKey.toBase58()).single();
  // A malformed owner index must fail even with an idempotent database receipt.
  await control({ corruptOwner: owner.publicKey.toBase58() });
  const invalid = await confirm(page, owner, alias, sent.signature); expect(invalid.status()).toBe(400); expect((await invalid.json()).code).toBe('PAYMENT_MISMATCH');
  const profile = await page.request.get(`/api/profile?wallet=${owner.publicKey.toBase58()}`); expect(profile.status()).toBe(409);
  const edit = await page.request.patch('/api/profile', { headers: { origin }, data: { design: { alias, name: 'No forgery', bio: '', links: [], accent: 'mint', layout: 'stack', buttonStyle: 'rounded', avatar: '', cover: '', socials: {} }, published: true, tips_enabled: true } });
  expect(edit.status()).not.toBe(200); expect(row.error).toBeNull();
  await context.close();
});

test('authentication, stale quotes, failed transactions and expired intent recovery', async ({ browser, request }) => {
  const context = await browser.newContext(); const owner = await installWallet(context); const page = await context.newPage(); await signIn(page); await expect(page).toHaveURL(/profile\/buy-alias/);
  const alias = 'dynamic_registry';
  const quote = await (await page.request.get(`/api/actions/claim-alias?alias=${alias}`)).json();
  const body = { account: owner.publicKey.toBase58(), priceLamports: quote.priceLamports, priceVersion: quote.priceVersion };
  expect((await request.post(`/api/actions/claim-alias?alias=${alias}`, { headers: { origin }, data: body })).status()).toBe(401);
  expect((await page.request.post(`/api/actions/claim-alias?alias=${alias}`, { headers: { origin: 'https://other.example' }, data: body })).status()).toBe(403);
  const payment = await prepare(page, owner, alias);
  await control({ prices: [920000000, 530000000, 300000000, 140000000, 20000000] });
  const stale = await page.request.post(`/api/actions/claim-alias?alias=${alias}`, { headers: { origin }, data: body }); expect(stale.status()).toBe(409); expect((await stale.json()).code).toBe('PRICE_CHANGED');
  const sent = await submit(payment, owner);
  expect((await confirm(page, owner, alias, sent.signature)).status()).toBe(400);
  await control({ advance: 160 });
  const fresh = await prepare(page, owner, alias); expect(fresh.priceSol).toBe('0.02'); expect(fresh.signature).not.toBe(payment.signature);
  await submit(fresh, owner); expect((await confirm(page, owner, alias, fresh.signature)).status()).toBe(200);
  // Plain transfers and arbitrary signatures cannot be used as registration proof.
  expect((await confirm(page, owner, alias, '1'.repeat(64))).status()).toBe(400);
  await control({ prices: [920000000, 530000000, 300000000, 140000000, 10000000] });
  await context.close();
});

test('old database-only claims reserve names and block edits until migration', async ({ browser }) => {
  const context = await browser.newContext(); const owner = await installWallet(context); const page = await context.newPage();
  await db().from('cards_users').insert({ username: 'legacy_registry', wallet_address: owner.publicKey.toBase58() });
  await signIn(page, '/dashboard/card');
  await expect(page.getByRole('alert').filter({ hasText: /migration/ }).first()).toBeVisible();
  const profile = await page.request.get('/api/profile'); expect(profile.status()).toBe(409); expect((await profile.json()).code).toBe('REGISTRY_MIGRATION_REQUIRED');
  await context.close();
});

test('broadcast intent survives lost browser storage and a profile-indexing outage without another payment', async ({ browser }) => {
  const context = await browser.newContext(); const owner = await installWallet(context); const page = await context.newPage();
  await signIn(page); await expect(page).toHaveURL(/profile\/buy-alias/);
  const payment = await prepare(page, owner, 'recover_registry'); await submit(payment, owner);
  // No confirmation/indexing yet; a fresh authenticated browser must discover
  // the successfully broadcast intent without receiving the owner private key.
  const fresh = await browser.newContext(); await installWallet(fresh, owner); const recovery = await fresh.newPage();
  await signIn(recovery, '/dashboard/card'); await expect(recovery).toHaveURL(/profile\/buy-alias/);
  await expect(recovery.getByRole('button', { name: 'Verify alias payment' })).toBeEnabled();
  await expect(recovery.getByLabel('Alias', { exact: true })).toHaveValue('recover_registry');
  await recovery.getByRole('button', { name: 'Verify alias payment' }).click();
  await expect(recovery).toHaveURL(/dashboard\/card/);
  expect(await recovery.evaluate(() => (window as unknown as { walletTestCalls: { transaction: number } }).walletTestCalls.transaction)).toBe(0);
  expect((await db().from('cards_users').select('tx_signature').eq('wallet_address', owner.publicKey.toBase58()).single()).data?.tx_signature).toBe(payment.signature);
  await Promise.all([context.close(), fresh.close()]);
});

test('sponsor reservations enforce an atomic global budget and deny anonymous ledger access', async () => {
  const database = db();
  const { data: rows, error } = await database.from('alias_registration_intents').select('*'); expect(error).toBeNull(); expect(rows?.length).toBeGreaterThan(0);
  const sample = rows![0];
  const spent = rows!.reduce((sum, row) => sum + Number(row.reserved_fee), 0);
  const candidates = [0,1].map(() => ({ ...sample, id: randomUUID(), wallet: Keypair.generate().publicKey.toBase58(), alias: 'budget_registry', signature: bs58.encode(randomBytes(64)) }));
  try {
    const results = await Promise.all(candidates.map(candidate => database.rpc('reserve_alias_registration', { candidate, daily_budget: spent + Number(sample.reserved_fee) })));
    expect(results.every(result => !result.error)).toBe(true);
    expect(results.filter(result => result.data.accepted)).toHaveLength(1); expect(results.filter(result => result.data.limited)).toHaveLength(1);
    const anonymous = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
    expect((await anonymous.from('alias_registration_intents').select('*')).error).toBeTruthy();
    expect((await anonymous.rpc('reserve_alias_registration', { candidate: candidates[0], daily_budget: 10000000 })).error).toBeTruthy();
  } finally { await database.from('alias_registration_intents').delete().in('id', candidates.map(candidate => candidate.id)); }
});
