import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { chromium, expect } from '@playwright/test';
const wallet = '11111111111111111111111111111111';
const design = { version: 1, alias: 'alice', name: 'Alice', bio: 'Artist', avatar: '', cover: '', accent: 'mint', theme: 'dark', rounded: true, links: [], socials: { instagram: '', youtube: '', x: '' } };
const profile = { id: 'profile-1', username: 'alice', wallet_address: wallet, display_name: 'Alice', bio: 'Artist', design, published: true, tips_enabled: true, updated_at: '2026-10-01T00:00:00Z' };
const db = createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  if (!['GET','HEAD'].includes(req.method)) { res.statusCode = 405; return res.end('{}'); }
  if (req.url.includes('wallet_sessions')) return res.end(JSON.stringify([{ wallet, expires_at: '2099-01-01T00:00:00Z' }]));
  if (req.url.includes('creator_tip_summary')) return res.end(JSON.stringify({lamports:'0',usdc_units:'0',count:0}));
  if (req.url.includes('/tips')) return res.end('[]');
  if (req.url.includes('sponsor_profiles')) return res.end(JSON.stringify([{alias:'alice',wallet,website:"",display_name:'Alice',bio:'Artist',price_cents:1000,duration_days:7,accepting:true,published:true,design}]));
  if (req.url.includes('sponsor_requests')) return res.end('[]');
  return res.end(JSON.stringify([profile]));
});
await new Promise(resolve => db.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:43147';
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '43147', '-H', '127.0.0.1'], { env: { ...process.env, SUPABASE_URL: `http://127.0.0.1:${db.address().port}`, SUPABASE_SECRET_KEY: 'fixture-key', VYNX_ALIAS_REGISTRY_ENABLED: 'false' }, stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`${origin}/icon.png`)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 150)); }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addCookies([{ name: 'vynx-session', value: 'a'.repeat(64), url: origin }]);
  let sessionWallet = wallet;
  await context.route('**/api/auth/session', route => route.fulfill({ json: { wallet: sessionWallet } }));
  const page = await context.newPage();

  for(const path of ['/', '/alice','/dashboard','/dashboard/card','/dashboard/card/preview','/dashboard/sponsorships','/dashboard/products','/dashboard/subscriptions','/dashboard/tickets','/dashboard/studio','/profile/buy-alias','/creators/alice']) {
    sessionWallet = path === "/" || path === "/profile/buy-alias" ? null : wallet;
    await page.goto(origin+path);
    await page.waitForTimeout(500);
    expect(new URL(page.url()).pathname).toBe(["/dashboard/subscriptions","/dashboard/tickets"].includes(path) ? "/dashboard/products" : path);
    for(let y=0;y<await page.locator('body').evaluate(el=>el.scrollHeight);y+=500){await page.evaluate(y=>window.scrollTo(0,y),y);await page.waitForTimeout(100);}
    const report=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
    const violations=report.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));

    console.log(`${path}: ${violations.length} violations`);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  }
  // Native skip-link navigation and a visible focus indicator.
  sessionWallet = null;
  await page.goto(origin);
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await page.locator(':focus').evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');

  sessionWallet = wallet;
  await page.goto(origin + '/dashboard/card');
  await page.getByRole('button', {name:'Apariencia',exact:true}).click();
  const firstAccent = page.getByRole('radio').first();
  await firstAccent.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio').nth(1)).toBeChecked();
  for (const name of ['Perfil','Apariencia','Enlaces','Redes','Ofertas']) {
    await page.getByRole('button', {name,exact:true}).click();
    const report = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
    expect(report.violations, `${name}: ${JSON.stringify(report.violations)}`).toEqual([]);
  }

  await page.goto(origin + '/dashboard/studio');
  const checkout = page.getByRole('button', {name:/Creator toolkit/}).first();
  await checkout.focus();
  await page.keyboard.press('Enter');
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await modal.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(modal).not.toBeVisible();
  await expect(checkout).toBeFocused();

  sessionWallet = null;
  design.theme = 'light';
  for (const path of ['/alice','/creators/alice']) {
    await page.goto(origin + path);
    await page.waitForTimeout(500);
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
  }
  await page.goto(origin + '/alice');
  const tipping = page.getByRole('button', {name:/Tips/});
  await tipping.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(tipping).toBeFocused();
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(origin);
  await page.waitForTimeout(1000);
  const hero = page.locator('img[src*="hero-card-asset"]').locator('..');
  const before = await hero.evaluate(el=>el.getBoundingClientRect().y);
  await page.waitForTimeout(500);
  expect(await hero.evaluate(el=>el.getBoundingClientRect().y)).toBe(before);
  expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
  console.log('Keyboard, dialog focus, editor labels, light theme, mobile, and reduced motion checks passed.');
}finally{if(browser)await browser.close();app.kill('SIGTERM');db.closeAllConnections();db.close();}
