import { test, expect } from './test';
import { createClient } from '@supabase/supabase-js';
import { installWallet, signIn } from './wallet';
import { EMPTY_DRAFT } from '../lib/creator-draft';

test('card preview fills the right sidebar and scrolls independently from the editor', async ({ context, page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const account = await installWallet(context), alias = `preview_${Date.now()}`;
  const design = { ...EMPTY_DRAFT, alias, name: 'Preview owner',
    links: Array.from({length:8},(_,index)=>({id:`link-${index}`,title:`Link ${index+1}`,url:`https://example.com/${index}`})),
    offers: Array.from({length:8},(_,index)=>({id:`offer-${index}`,type:'digital',title:`Offer ${index+1}`,description:'A useful resource.',price:'25',url:'',billingPeriod:'session'})) };
  const db = createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!);
  expect((await db.from('cards_users').insert({wallet_address:account.publicKey.toBase58(),username:alias,display_name:design.name,design,published:true})).error).toBeNull();
  await signIn(page,'/dashboard/card');
  await expect(page.getByLabel('Creator name',{exact:true})).toHaveValue(design.name);
  await page.getByRole('tab',{name:'Offers',exact:true}).click();
  const sidebar = page.getByTestId('card-preview-sidebar'), scroll = page.getByTestId('card-preview-scroll');
  const bounds = (await sidebar.boundingBox())!;
  expect(bounds.y).toBe(0); expect(bounds.height).toBe(900);
  expect(bounds.x+bounds.width).toBe(1280);
  const main = (await page.locator('#main-content').boundingBox())!;
  expect(main.x+main.width).toBeLessThanOrEqual(bounds.x);
  const handle = page.getByRole('separator',{name:'Resize card preview',exact:true});
  const grip = (await handle.boundingBox())!;
  await page.mouse.move(grip.x+4,grip.y+100); await page.mouse.down();
  await page.mouse.move(grip.x-96,grip.y+100,{steps:5}); await page.mouse.up();
  await expect(handle).toHaveAttribute('aria-valuenow','500');
  expect((await sidebar.boundingBox())!.width).toBe(500);
  const disconnect = (await page.getByRole('button',{name:'Disconnect',exact:true}).boundingBox())!;
  expect(disconnect.x+disconnect.width).toBeLessThan((await sidebar.boundingBox())!.x);
  await handle.press('ArrowRight'); await expect(handle).toHaveAttribute('aria-valuenow','480');
  await handle.press('Home'); await expect(handle).toHaveAttribute('aria-valuenow','320');
  await handle.press('End'); await expect(handle).toHaveAttribute('aria-valuenow','544');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.mouse.move((await handle.boundingBox())!.x+4,100); await page.mouse.down();
  await page.mouse.move(1200,100,{steps:5}); await page.mouse.up();
  await expect(handle).toHaveAttribute('aria-valuenow','320');
  expect(await page.evaluate(()=>getComputedStyle(document.body).userSelect)).not.toBe('none');
  for(let step=0;step<4;step++) await handle.press('ArrowLeft');
  await expect(handle).toHaveAttribute('aria-valuenow','400');
  expect(await scroll.evaluate(element=>getComputedStyle(element).scrollbarColor)).toBe('rgb(82, 82, 91) rgb(16, 16, 21)');
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollbarColor)).toBe('rgb(82, 82, 91) rgb(16, 16, 21)');
  await page.getByLabel('Offer title 1',{exact:true}).fill('Updated offer');
  await expect(scroll.getByRole('button',{name:/^Updated offer/})).toHaveCount(1);
  expect(await scroll.evaluate(element=>element.scrollHeight>element.clientHeight)).toBe(true);
  const windowScroll = await page.evaluate(()=>scrollY);
  await scroll.evaluate(element=>element.scrollTop=400);
  expect(await scroll.evaluate(element=>element.scrollTop)).toBe(400);
  expect(await page.evaluate(()=>scrollY)).toBe(windowScroll);
  await page.evaluate(()=>window.scrollBy(0,300));
  expect(await scroll.evaluate(element=>element.scrollTop)).toBe(400);
  expect((await sidebar.boundingBox())!.y).toBe(0);
  await scroll.focus(); await scroll.press('End');
  await expect.poll(()=>scroll.evaluate(element=>element.scrollTop)).toBeGreaterThan(400);
  await scroll.evaluate(element=>element.scrollTop=0);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:testInfo.outputPath('card-preview-sidebar.png'),fullPage:false});
  for (const width of [320,390,1024,1536]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(await scroll.evaluate(element=>getComputedStyle(element).overflowY)).toBe('auto');
    if (width>=1280) expect((await sidebar.boundingBox())!.height).toBe(900);
    else expect((await sidebar.boundingBox())!.height).toBe(720);
  }
});
