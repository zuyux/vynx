import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './test';
import { createClient } from '@supabase/supabase-js';
import { Keypair, PublicKey, Transaction, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { createPrivateKey, sign } from 'node:crypto';
import { installWallet, signIn } from './wallet';

const db = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const origin = process.env.E2E_BASE_URL!;

test('creator claims, publishes, reloads, receives a verified tip and logs out', async ({ browser }) => {
  const creatorContext = await browser.newContext();
  const owner = await installWallet(creatorContext);
  const creatorPage = await creatorContext.newPage();
  const alias = `creator_${Date.now()}`;
  await creatorPage.goto('/');
  await expect(creatorPage.getByRole('button', { name: 'Connect wallet', exact: true })).toBeVisible();
  expect(await creatorPage.evaluate(() => (window as unknown as { walletTestCalls: { connect: number } }).walletTestCalls.connect)).toBe(0);
  await creatorPage.getByRole('textbox', { name: 'Claim your alias' }).fill(alias);
  await creatorPage.locator('form').getByRole('button', { name: 'CLAIM YOUR CARD →', exact: true }).click();
  await creatorPage.getByRole('button', { name: 'Phantom', exact: true }).click();
  await expect(creatorPage).toHaveURL(/profile\/buy-alias/);
  await expect(creatorPage.getByLabel('Alias', { exact: true })).toHaveValue(alias);
  await creatorPage.getByRole('button', { name: /Claim alias/ }).click();
  await expect(creatorPage).toHaveURL(/dashboard\/card/);
  await expect(creatorPage.getByLabel('Alias', { exact: true })).toHaveValue(alias);
  await expect(creatorPage.getByLabel('Alias', { exact: true })).toHaveAttribute('readonly', '');
  // A connected wallet is not a signed-in session. Recover a direct visit
  // without exposing the unpublished profile or sending another payment.
  await creatorContext.clearCookies();
  const privateResponse = await creatorPage.goto(`/${alias}`);
  expect([200, 404]).toContain(privateResponse?.status());
  await expect(creatorPage.getByRole('heading', { name: 'Card unavailable' })).toBeVisible();
  const transactionsBeforeSignIn = await creatorPage.evaluate(() => (window as unknown as { walletTestCalls: { transaction: number } }).walletTestCalls.transaction);
  await creatorPage.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await creatorPage.getByRole('button', { name: 'Phantom', exact: true }).click();
  await expect(creatorPage.getByRole('status').filter({ hasText: 'Your card is unpublished' })).toBeVisible();
  await expect(creatorPage.getByRole('link', { name: 'Edit my creator card', exact: true })).toBeVisible();
  expect(await creatorPage.evaluate(() => (window as unknown as { walletTestCalls: { transaction: number } }).walletTestCalls.transaction)).toBe(transactionsBeforeSignIn);

  await creatorPage.goto('/');
  await expect(creatorPage).toHaveURL('/');
  await creatorPage.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await creatorPage.getByRole('button', { name: 'Phantom', exact: true }).click();
  await expect(creatorPage).toHaveURL(`/${alias}`);
  await expect(creatorPage.getByRole('status').filter({ hasText: 'Your card is unpublished' })).toBeVisible();
  const anonymousPage = await browser.newPage();
  expect([200, 404]).toContain((await anonymousPage.goto(`/${alias}`))?.status());
  await expect(anonymousPage.getByRole('heading', { name: 'Card unavailable' })).toBeVisible();
  await anonymousPage.close();
  await creatorPage.getByRole('link', { name: 'Edit my creator card', exact: true }).click();
  await expect(creatorPage).toHaveURL('/dashboard/card');

  for (const width of [320, 375, 430]) {
    await creatorPage.setViewportSize({ width, height: 844 });
    expect(await creatorPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const name of ["Save and publish", "Save local draft", "Reload my saved profile", "Save without publishing"]) {
      const action = creatorPage.getByRole('button', { name, exact: true });
      expect(await action.evaluate(element => Math.abs(element.getBoundingClientRect().width - element.parentElement!.getBoundingClientRect().width) < 2), `${name} fills its action group at ${width}px`).toBe(true);
      expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const disconnect = await creatorPage.getByRole('button', { name: 'Disconnect', exact: true }).boundingBox();
    expect(disconnect!.width).toBeGreaterThanOrEqual(44);
    expect(disconnect!.height).toBeGreaterThanOrEqual(44);
    await creatorPage.getByRole('tab', { name: "Offers", exact: true }).click();
    expect(await creatorPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await creatorPage.getByRole('tab', { name: "Profile", exact: true }).click();
  }
  await creatorPage.setViewportSize({ width: 1280, height: 900 });
  await creatorPage.getByLabel("Creator name").fill('E2E creator');
  await creatorPage.getByLabel("Introduction").fill('My saved creator story');
  await creatorPage.getByRole('tab', { name: "Links", exact: true }).click();
  await creatorPage.getByRole('button', { name: /Add link/ }).click();
  await creatorPage.getByLabel('Link title 1').fill('My project');
  await creatorPage.getByLabel('Link URL 1').fill('https://example.com/project');
  await creatorPage.getByRole('button', { name: "Save and publish", exact: true }).click();
  await expect(creatorPage.getByRole('status').filter({ hasText: /Design published/ })).toBeVisible();
  await creatorPage.reload();
  await expect(creatorPage.getByLabel("Creator name")).toHaveValue('E2E creator');
  await expect(creatorPage.getByLabel("Introduction")).toHaveValue('My saved creator story');
  const saved = await db().from('cards_users').select('*').eq('wallet_address', owner.publicKey.toBase58()).single();
  expect(saved.error).toBeNull(); expect(saved.data.published).toBe(true); expect(saved.data.design.links[0].title).toBe('My project');
  await creatorPage.goto('/');
  await expect(creatorPage).toHaveURL('/');
  await creatorPage.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await creatorPage.getByRole('button', { name: 'Phantom', exact: true }).click();
  await expect(creatorPage).toHaveURL(`/${alias}`);
  await expect(creatorPage.getByRole('link', { name: 'Edit my creator card', exact: true })).toBeVisible();
  await creatorPage.getByRole('link', { name: 'Edit my creator card', exact: true }).click();
  await expect(creatorPage).toHaveURL('/dashboard/card');
  await creatorPage.goto('/profile/buy-alias');
  await creatorPage.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await creatorPage.getByRole('button', { name: 'Phantom', exact: true }).click();
  await expect(creatorPage).toHaveURL(`/${alias}`);
  const claimRetry = await creatorPage.request.post(`/api/actions/claim-alias/confirm?alias=${alias}`, { data: { account: owner.publicKey.toBase58(), signature: saved.data.tx_signature } });
  expect(claimRetry.status()).toBe(200);
  const cookies = await creatorContext.cookies();
  const sessionCookie = cookies.find(cookie => cookie.name === 'vynx-session')!;
  expect(sessionCookie.httpOnly).toBe(true); expect(sessionCookie.sameSite).toBe('Lax');
  const sessions = await db().from('wallet_sessions').select('token_hash').eq('wallet', owner.publicKey.toBase58());
  expect(sessions.data?.some(session => session.token_hash === sessionCookie.value)).toBe(false);
  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  const publicResponse = await visitor.goto(`/${alias}`);
  expect(publicResponse?.status()).toBe(200);
  await expect(visitor.getByRole('heading', { name: 'E2E creator' })).toBeVisible();
  await expect(visitor.getByRole('link', { name: 'Edit my creator card', exact: true })).toHaveCount(0);
  await expect(visitor.getByText('My saved creator story').filter({ visible: true })).toBeVisible();
  await expect(visitor.getByRole('link', { name: 'My project' })).toHaveAttribute('href', 'https://example.com/project');
  await visitor.goto(`/@${alias}`); await expect(visitor.getByRole('heading', { name: 'E2E creator' })).toBeVisible();
  const missing = await visitor.request.get('/does_not_exist'); expect([200, 404]).toContain(missing.status()); expect(await missing.text()).toContain('Card unavailable');
  const unauthorized = await visitor.request.patch('/api/profile', { headers: { origin }, data: { design: saved.data.design, published: true, tips_enabled: true } }); expect(unauthorized.status()).toBe(401);
  const taken = await visitor.request.post(`/api/actions/claim-alias?alias=${alias}`, { data: { account: Keypair.generate().publicKey.toBase58() } }); expect(taken.status()).toBe(409);
  // The isolated browser users share a loopback IP. Give the new fan its own
  // auth quota after testing the creator's repeated explicit reconnects.
  expect((await db().from('public_endpoint_limits').delete().neq('client_hash', '')).error).toBeNull();
  const fanContext = await browser.newContext();
  const fan = await installWallet(fanContext);
  const fanPage = await fanContext.newPage();
  await signIn(fanPage); await expect(fanPage).toHaveURL(/profile\/buy-alias/);
  const cannotEdit = await fanPage.request.patch('/api/profile', { headers: { origin }, data: { design: saved.data.design, published: true, tips_enabled: true } }); expect(cannotEdit.status()).toBe(409);
  await fanPage.getByLabel('Alias', { exact: true }).fill(`fan_${Date.now()}`);
  await fanPage.getByRole('button', { name: /Claim alias/ }).click();
  await expect(fanPage).toHaveURL(/dashboard\/card/);
  await fanPage.goto(`/${alias}`);
  await fanPage.getByRole('button', { name: 'Tips USDC', exact: true }).click();
  await expect(fanPage.getByRole('button', { name: 'SOL', exact: true })).toHaveCount(0);
  await fanPage.getByRole('button', { name: 'Connect wallet to tip' }).click();
  await fanPage.getByRole('button', { name: 'Phantom', exact: true }).click();
  await expect(fanPage.getByRole('button', { name: 'Send 1 USDC tip' })).toBeVisible();
  await fanPage.evaluate(() => { (window as unknown as { walletTestReject: boolean }).walletTestReject = true; });
  await fanPage.getByRole('button', { name: 'Send 1 USDC tip' }).click();
  await expect(fanPage.getByRole('alert').filter({ hasText: 'cancelled' })).toContainText('Wallet approval was cancelled');
  expect((await db().from('tips').select('id').eq('creator_id', saved.data.id)).data).toHaveLength(0);
  expect((await fanPage.request.post('/api/tips', { headers: { origin }, data: { alias, amount: '1', currency: 'SOL' } })).status()).toBe(400);
  await fanPage.getByRole('button', { name: 'Send 1 USDC tip', exact: true }).click();
  await expect(fanPage.getByRole('status')).toContainText('Tip confirmed');
  const usdcTips = await db().from('tips').select('*').eq('creator_id', saved.data.id).eq('currency', 'USDC');
  expect(usdcTips.data).toHaveLength(1);
  expect(usdcTips.data![0].payer).toBe(fan.publicKey.toBase58());
  expect(Number(usdcTips.data![0].token_amount)).toBe(1000000);
  expect(usdcTips.data![0].lamports).toBeNull();
  const usdcConfirmation = { alias, amount: '1', currency: 'USDC', signature: usdcTips.data![0].signature };
  expect((await fanPage.request.post('/api/tips/confirm', { headers: { origin }, data: usdcConfirmation })).status()).toBe(200);
  expect((await fanPage.request.post('/api/tips/confirm', { headers: { origin }, data: { ...usdcConfirmation, currency: 'SOL' } })).status()).toBe(409);
  await creatorPage.goto('/dashboard');
  await expect(creatorPage.getByTestId('tip-total-sol')).toHaveText('0 SOL');
  await expect(creatorPage.getByTestId('tip-total')).toHaveText('1 USDC');
  await expect(creatorPage.getByTestId('tip-count')).toHaveText('1');
  await creatorPage.getByRole('button', { name: "Disconnect", exact: true }).click();
  await expect(creatorPage).toHaveURL('/');
  expect((await creatorContext.cookies()).some(cookie => cookie.name === 'vynx-session')).toBe(false);
  const revoked = await creatorPage.request.get('/api/dashboard', { headers: { cookie: `vynx-session=${sessionCookie.value}` } }); expect(revoked.status()).toBe(401);
  await creatorPage.goto('/dashboard/card'); await expect(creatorPage).toHaveURL('/dashboard/card'); await expect(creatorPage.getByRole('button', { name: 'Connect wallet', exact: true })).toBeVisible();
  await Promise.all([creatorContext.close(), visitorContext.close(), fanContext.close()]);
});

test('sign-in rejects forged, expired, replayed and cross-origin challenges', async ({ request }) => {
  const wallet = Keypair.generate();
  const address = wallet.publicKey.toBase58();
  const issue = await request.post('/api/auth/nonce', { headers: { origin }, data: { wallet: address } });
  expect(issue.status()).toBe(200);
  const nonce = await issue.json();
  const secret = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(wallet.secretKey.slice(0,32))]), format: 'der', type: 'pkcs8' });
  const signature = sign(null, Buffer.from(nonce.message), secret).toString('hex');
  const forged = await request.post('/api/auth/session', { headers: { origin }, data: { wallet: address, id: nonce.id, signature: '00'.repeat(64) } }); expect(forged.status()).toBe(401);
  const foreignOrigin = await request.post('/api/auth/session', { headers: { origin: 'https://attacker.example' }, data: { wallet: address, id: nonce.id, signature } }); expect(foreignOrigin.status()).toBe(403);
  const login = await request.post('/api/auth/session', { headers: { origin }, data: { wallet: address, id: nonce.id, signature } }); expect(login.status()).toBe(200);
  const replay = await request.post('/api/auth/session', { headers: { origin, cookie: `vynx-nonce=${nonce.id}` }, data: { wallet: address, id: nonce.id, signature } }); expect(replay.status()).toBe(401);
  const expiredIssue = await request.post('/api/auth/nonce', { headers: { origin }, data: { wallet: address } });
  const expired = await expiredIssue.json();
  await db().from('wallet_nonces').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('id', expired.id);
  const expiredLogin = await request.post('/api/auth/session', { headers: { origin }, data: { wallet: address, id: expired.id, signature: sign(null, Buffer.from(expired.message), secret).toString('hex') } }); expect(expiredLogin.status()).toBe(401);
  const session = await request.get('/api/auth/session'); expect((await session.json()).wallet).toBe(address);
  const anonymous = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
  for (const table of ['wallet_sessions', 'wallet_nonces', 'tips', 'cards_users']) expect((await anonymous.from(table).select('*')).error).not.toBeNull();
});

test('payment verifier rejects failed transactions and mismatched tip memos', async ({ request }) => {
  const wallet = Keypair.generate();
  const recipient = Keypair.generate();
  const alias = `tip_test_${Date.now()}`;
  await db().from('cards_users').insert({ username: alias, wallet_address: recipient.publicKey.toBase58(), published: true });
  const issue = await request.post('/api/auth/nonce', { headers: { origin }, data: { wallet: wallet.publicKey.toBase58() } });
  const nonce = await issue.json();
  const secret = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'), Buffer.from(wallet.secretKey.slice(0,32))]), format: 'der', type: 'pkcs8' });
  await request.post('/api/auth/session', { headers: { origin }, data: { wallet: wallet.publicKey.toBase58(), id: nonce.id, signature: sign(null, Buffer.from(nonce.message), secret).toString('hex') } });
  for (const failed of [true, false]) {
    const block = await fetch(`${process.env.E2E_FIXTURE_URL}/rpc`, { method: 'POST', body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'getLatestBlockhash', params:[] }) }).then(response => response.json());
    const tx = new Transaction({ feePayer: wallet.publicKey, blockhash: block.result.value.blockhash, lastValidBlockHeight:100000 });
    tx.add(SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: recipient.publicKey, lamports:10000000 }));
    tx.add(new TransactionInstruction({ programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'), data: Buffer.from('wrong-creator'), keys: [] }));
    tx.sign(wallet);
    const submitted = await fetch(`${process.env.E2E_FIXTURE_URL}/test/submit`, { method:'POST', body:JSON.stringify({ transaction:tx.serialize().toString('base64'), failed }) }).then(response => response.json());
    const confirmation = await request.post('/api/tips/confirm', { headers:{origin}, data:{alias,amount:'0.01',signature:submitted.signature} }); expect(confirmation.status()).toBe(400);
  }
  expect((await db().from('tips').select('id').eq('recipient',recipient.publicKey.toBase58())).data).toHaveLength(0);
});

test('profile images, socials and theme persist; unpublished pages stay private', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const owner = await installWallet(context);
  const alias = `profile_${Date.now()}`;
  const inserted = await db().from('cards_users').insert({ username: alias, wallet_address: owner.publicKey.toBase58() });
  expect(inserted.error).toBeNull();
  const page = await context.newPage();
  await signIn(page, '/dashboard/card');
  await expect(page).toHaveURL(/dashboard\/card/);
  await expect(page.getByLabel("Creator name")).toBeEnabled();
  await page.getByRole('tab', { name: "Profile", exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: "Appearance", exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: "Profile", exact: true }).click();
  const privacy = page.getByRole('switch', { name: "Show tip sender addresses in my activity", exact: true });
  await privacy.check();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(privacy).not.toBeChecked();
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: "Cancel", exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await page.getByLabel("Creator name").fill('Mobile creator');
  await page.getByLabel("Upload profile photo").setInputFiles('public/favicon-16x16.png');
  await expect(page.getByAltText("Selected profile photo")).toBeVisible();
  await expect(page.getByLabel("Upload cover")).toHaveCount(0);
  await page.getByLabel("Receive tips in USDC").uncheck();
  await page.getByRole('tab', { name: "Appearance", exact: true }).click();
  await page.getByRole('group', { name: 'Page background' }).getByRole('radio', { name: 'White', exact: true }).check();
  await page.getByRole('tab', { name: "Socials", exact: true }).click();
  await page.getByRole('textbox', { name: 'YouTube', exact: true }).fill('http://youtube.com/unsafe');
  await expect(page.getByRole('textbox', { name: 'YouTube', exact: true })).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('textbox', { name: 'YouTube', exact: true }).fill('https://youtube.com/@mobilecreator');
  expect((await new AxeBuilder({ page }).include('[data-slot="tabs"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('card-editor-mobile.png'), fullPage: true });
  await expect(page.getByRole('textbox', { name: 'YouTube', exact: true })).toHaveAttribute('aria-invalid', 'false');
  await page.getByRole('button', { name: "Save and publish", exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Design published' })).toBeVisible();
  const saved = await db().from('cards_users').select('design,tips_enabled').eq('username', alias).single();
  expect(saved.data!.design.theme).toBe('light'); expect(saved.data!.tips_enabled).toBe(false);
  expect(saved.data!.design.avatar).toContain(`/storage/v1/object/public/creator-images/${owner.publicKey.toBase58()}/`);
  expect((await page.request.get(saved.data!.design.avatar)).status()).toBe(200);
  const visitor = await browser.newContext();
  const publicPage = await visitor.newPage();
  await publicPage.goto(`/${alias}`);
  await expect(publicPage.getByAltText('Mobile creator avatar').filter({ visible: true })).toBeVisible();
  await expect(publicPage.getByAltText('Mobile creator cover')).toHaveCount(0);
  await expect(publicPage.getByRole('link', { name: 'YouTube', exact: true })).toHaveAttribute('href', 'https://youtube.com/@mobilecreator');
  await expect(publicPage.getByText('Tips are currently paused.')).toBeHidden();
  const tipsButton = publicPage.getByRole('button', { name: 'Tips Paused', exact: true });
  await tipsButton.click();
  await expect(publicPage.getByRole('dialog', { name: `Tip @${alias}` })).toBeVisible();
  await expect(publicPage.getByText('Tips are currently paused.')).toBeVisible();
  await publicPage.getByRole('button', { name: 'Close tipping', exact: true }).click();
  await expect(publicPage.getByRole('dialog')).toBeHidden();
  await expect(tipsButton).toBeFocused();
  await tipsButton.click();
  await publicPage.keyboard.press('Escape');
  await expect(publicPage.getByRole('dialog')).toBeHidden();
  expect(await publicPage.locator('main').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(publicPage.locator('link[rel="canonical"]')).toHaveAttribute('href', `${origin}/${alias}`);
  const pausedTip = await page.request.post('/api/tips', { headers: { origin }, data: { alias, amount: '0.01' } }); expect(pausedTip.status()).toBe(404);
  await expect(publicPage.getByRole('button', { name: 'Edit creator name', exact: true })).toHaveCount(0);
  await expect(publicPage.getByLabel('Update card portrait')).toHaveCount(0);
  await page.goto(`/${alias}`);
  await expect(page.getByTestId('creator-card')).toHaveCount(1);
  const cardSize = await page.getByTestId('creator-card').boundingBox();
  expect(cardSize!.height / cardSize!.width).toBeCloseTo(1.618, 1);
  await page.getByRole('button', { name: 'Edit creator name', exact: true }).click();
  await page.getByLabel('Creator name', { exact: true }).fill('Updated portrait creator');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByRole('button', { name: 'Phantom', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Card updated.' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit creator bio', exact: true }).click();
  await page.getByLabel('Creator bio', { exact: true }).fill('Edited directly on my card.');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByText('Edited directly on my card.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit creator bio', exact: true }).click();
  await page.getByLabel('Creator bio', { exact: true }).fill('Edited directly on my card.');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Card updated.' })).toBeVisible();
  await page.getByLabel('Update card portrait').setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
  await expect(page.getByRole('alert').filter({ hasText: 'Choose a JPG, PNG or WebP' })).toBeVisible();
  await page.getByLabel('Update card portrait').setInputFiles('public/favicon-32x32.png');
  await expect(page.getByRole('status').filter({ hasText: 'Card updated.' })).toBeVisible();
  const updated = await db().from('cards_users').select('design,published,tips_enabled').eq('username', alias).single();
  expect(updated.data!.design.avatar).not.toBe(saved.data!.design.avatar);
  expect((await page.request.get(saved.data!.design.avatar)).status()).toBe(404);
  expect((await page.request.get(updated.data!.design.avatar)).status()).toBe(200);
  expect(updated.data!.design.theme).toBe('light');
  expect(updated.data!.design.socials.youtube).toBe('https://youtube.com/@mobilecreator');
  expect(updated.data!.published).toBe(true); expect(updated.data!.tips_enabled).toBe(false);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Updated portrait creator' })).toBeVisible();
  await expect(page.getByText('Edited directly on my card.', { exact: true }).filter({ visible: true })).toBeVisible();
  for (const width of [320, 390, 479]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath('vertical-creator-card.png'), fullPage: true });
  await publicPage.reload();
  await expect(publicPage.getByRole('heading', { name: 'Updated portrait creator' })).toBeVisible();
  await page.goto('/dashboard/card');

  await page.getByRole('button', { name: "Save without publishing", exact: true }).click();
  await page.getByRole('button', { name: 'Phantom', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your public page is hidden' })).toBeVisible();
  const hidden = await publicPage.request.get(`/${alias}`); expect([200, 404]).toContain(hidden.status()); expect(await hidden.text()).toContain('Card unavailable');
  const exposed = await publicPage.request.get(`/api/profile?wallet=${owner.publicKey.toBase58()}`);
  expect(Object.keys((await exposed.json()).profile).sort()).toEqual(['username','wallet_address']);
  await db().from('wallet_sessions').update({ expires_at: new Date(Date.now()-1000).toISOString() }).eq('wallet', owner.publicKey.toBase58());
  expect((await page.request.get('/api/profile')).status()).toBe(401);
  await page.goto('/dashboard/card'); await expect(page).toHaveURL('/dashboard/card'); await expect(page.getByRole('button', { name: 'Connect wallet', exact: true })).toBeVisible();
  await Promise.all([context.close(), visitor.close()]);
});


test('wallet authentication handles rejection and invites new users to claim an alias', async ({ browser }) => {
  const context = await browser.newContext();
  await installWallet(context);
  const page = await context.newPage();
  await page.goto('/');
  await page.evaluate(() => { (window as unknown as { walletTestReject: boolean }).walletTestReject = true; });
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await page.getByRole('button', { name: 'Phantom', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'cancelled' })).toBeVisible();
  await expect(page).toHaveURL('/');
  expect((await page.request.get('/api/auth/session').then(response => response.json())).wallet).toBeNull();
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await page.getByRole('button', { name: 'Phantom', exact: true }).click();
  await expect(page).toHaveURL(/profile\/buy-alias\?welcome=1/);
  await expect(page.getByRole('heading', { name: 'Claim your alias' })).toBeVisible();
  await expect(page.getByText('Welcome to Vynx.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { walletTestCalls: { message: number } }).walletTestCalls.message)).toBe(2);
  await context.close();
});

test('old editor and preview URLs redirect to the card routes and preserve query parameters', async ({ request }) => {
  for (const [oldPath, newPath] of [
    ['/dashboard/mypage?tab=links', '/dashboard/card?tab=links'],
    ['/dashboard/mypage/preview?source=bookmark', '/dashboard/card/preview?source=bookmark'],
  ]) {
    const response = await request.get(oldPath, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    const location = new URL(response.headers().location, process.env.E2E_BASE_URL);
    expect(location.pathname + location.search).toBe(newPath);
  }
});
