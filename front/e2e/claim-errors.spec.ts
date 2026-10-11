import { test, expect } from './test';
import { createClient } from '@supabase/supabase-js';
import { Keypair } from '@solana/web3.js';
import { installWallet } from './wallet';

test('alias claim errors guide recovery and verification never resends the payment', async ({ browser }) => {
  const context = await browser.newContext();
  const wallet = await installWallet(context);
  const page = await context.newPage();
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
  const taken = `taken_${Date.now()}`;
  const otherWallet = Keypair.generate().publicKey.toBase58();
  try {
    await page.goto('/profile/buy-alias');
    await page.getByLabel('Alias', { exact: true }).fill(`signin_${Date.now()}`);
    await page.evaluate(() => { (window as unknown as { walletTestReject: boolean }).walletTestReject = true; });
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await page.getByRole('button', { name: 'Phantom', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'approve the sign-in message' })).toBeVisible();
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
    await page.getByRole('button', { name: 'Phantom', exact: true }).click();
    const claim = page.getByRole('button', { name: /Claim alias/ });
    await expect(claim).toBeEnabled();
    expect((await db.from('cards_users').insert({ wallet_address: otherWallet, username: taken })).error).toBeNull();
    await page.getByLabel('Alias', { exact: true }).fill(taken);
    await claim.click();
    await expect(page.getByRole('alert').filter({ hasText: 'Choose a different alias' })).toBeVisible();
    const takenResponse = await page.request.post(`/api/actions/claim-alias?alias=${taken}`, { data: { account: wallet.publicKey.toBase58() } });
    expect(takenResponse.status()).toBe(409);
    expect((await takenResponse.json()).code).toBe('ALIAS_TAKEN');
    await page.getByLabel('Alias', { exact: true }).fill(`recover_${Date.now()}`);
    for (const [error, expected] of [
      [{ code: 4001, message: 'User rejected the transaction' }, 'approve the alias payment'],
      [{ code: 'USER_CANCELLED', message: 'Popup closed' }, 'cancelled'],
      [{ message: 'Transaction simulation failed: insufficient funds for rent' }, 'Add devnet SOL'],
    ] as const) {
      await page.evaluate(error => { (window as unknown as { walletTestTransactionError: unknown }).walletTestTransactionError = error; }, error);
      await claim.click();
      await expect(page.getByRole('alert').filter({ hasText: expected })).toBeVisible();
      await expect(page.getByText(/Payment sent:/)).toHaveCount(0);
    }
    await page.route('**/api/actions/claim-alias/confirm?*', route => route.fulfill({
      status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Payment below the alias price', code: 'INSUFFICIENT_PAYMENT' }),
    }));
    await claim.click();
    await expect(page.getByRole('alert').filter({ hasText: 'below the required' })).toBeVisible();
    await expect(page.getByText(/Payment sent:/)).toBeVisible();
    const calls = await page.evaluate(() => (window as unknown as { walletTestCalls: { transaction: number } }).walletTestCalls.transaction);
    await page.unroute('**/api/actions/claim-alias/confirm?*');
    await page.route('**/api/actions/claim-alias/confirm?*', route => route.fulfill({
      status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'RPC timed out', code: 'RPC_TIMEOUT' }),
    }));
    await page.getByRole('button', { name: 'Verify alias payment' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Retry verification instead of paying again' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Verify alias payment' })).toBeVisible();
    await expect(page.getByText(/Payment sent:/)).toBeVisible();
    await page.unroute('**/api/actions/claim-alias/confirm?*');
    await page.getByRole('button', { name: 'Verify alias payment' }).click();
    await expect(page).toHaveURL(/dashboard\/card/);
    expect(await page.evaluate(() => (window as unknown as { walletTestCalls: { transaction: number } }).walletTestCalls.transaction)).toBe(calls);
  } finally {
    expect((await db.from('cards_users').delete().eq('wallet_address', otherWallet)).error).toBeNull();
    await context.close();
  }
});
