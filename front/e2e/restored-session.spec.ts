import { test, expect } from './test';
import { createClient } from '@supabase/supabase-js';
import { Keypair } from '@solana/web3.js';
import { createHash, randomBytes } from 'node:crypto';
import { EMPTY_DRAFT } from '../lib/creator-draft';

// Model the HttpOnly app session left by Google OAuth after a full page reload.
// Saving a profile needs this session, not another wallet connection or OAuth flow.
for (const sessionState of ['valid', 'expired', 'changed', 'unavailable'] as const) {
  test(`saving with a restored ${sessionState} session`, async ({ page, context }) => {
    const wallet = Keypair.generate().publicKey.toBase58();
    const design = { ...EMPTY_DRAFT, alias: `google_${randomBytes(6).toString('hex')}`, name: 'Google creator' };
    const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
    const token = randomBytes(32).toString('hex');
    expect((await db.from('cards_users').insert({ wallet_address: wallet, username: design.alias, display_name: design.name, design, published: false })).error).toBeNull();
    expect((await db.from('wallet_sessions').insert({ token_hash: createHash('sha256').update(token).digest('hex'), wallet, expires_at: new Date(Date.now() + 60_000 * 60).toISOString() })).error).toBeNull();
    await context.addCookies([{ name: 'vynx-session', value: token, url: process.env.E2E_BASE_URL!, httpOnly: true, sameSite: 'Lax' }]);
    let checkingSave = false;
    const writes: { design: typeof design; published: boolean }[] = [];
    await page.route('**/api/auth/session', route => {
      if (checkingSave && sessionState === 'unavailable') return route.fulfill({ status: 503, json: { error: 'Unable to verify sign-in.' } });
      const address = !checkingSave || sessionState === 'valid' ? wallet : sessionState === 'expired' ? null : 'another-wallet';
      return route.fulfill({ json: { wallet: address, alias: design.alias } });
    });
    await page.route('**/api/profile**', async route => {
      if (route.request().method() === 'PATCH') writes.push(route.request().postDataJSON());
      const last = writes.at(-1);
      await route.fulfill({ json: { profile: { wallet_address: wallet, username: design.alias,
        display_name: last?.design.name ?? design.name, bio: '', design: last?.design ?? design,
        published: last?.published ?? false, tips_enabled: true } } });
    });
    await page.goto('/dashboard/card', { waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Creator name', { exact: true })).toHaveValue(design.name);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Creator name', { exact: true })).toHaveValue(design.name);
    await page.getByLabel('Creator name', { exact: true }).fill('Updated Google creator');
    checkingSave = true;
    await page.getByRole('button', { name: 'Save without publishing', exact: true }).click();
    if (sessionState === 'valid') {
      await expect(page.getByRole('status').filter({ hasText: 'Profile saved.' })).toBeVisible();
      await page.getByRole('button', { name: 'Save and publish', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Design published.' })).toBeVisible();
      expect(writes.map(write => write.published)).toEqual([false, true]);
      expect(writes.every(write => write.design.name === 'Updated Google creator')).toBe(true);
      await expect(page.getByRole('dialog', { name: 'Sign in', exact: true })).toHaveCount(0);
    } else {
      if (sessionState === 'unavailable') {
        await expect(page.getByRole('alert').filter({ hasText: 'Unable to verify sign-in.' })).toBeVisible();
        await expect(page.getByRole('dialog', { name: 'Sign in', exact: true })).toHaveCount(0);
      } else {
        await expect(page.getByRole('dialog', { name: 'Sign in', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Close sign-in', exact: true }).click();
      }
      expect(writes).toHaveLength(0);
      await expect(page.getByLabel('Creator name', { exact: true })).toHaveValue('Updated Google creator');
    }
  });
}
