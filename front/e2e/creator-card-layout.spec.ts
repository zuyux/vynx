import { test, expect } from './test';
import { createClient } from '@supabase/supabase-js';
import { Keypair } from '@solana/web3.js';
import AxeBuilder from '@axe-core/playwright';
import { EMPTY_DRAFT } from '../lib/creator-draft';

test('social icons stay inside the card while offers, links and tips remain below on light and dark pages', async ({ page }, testInfo) => {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
  for (const theme of ['dark', 'light'] as const) {
    const alias = `layout_${theme}_${Date.now()}`;
    const design = { ...EMPTY_DRAFT, alias, theme, name: 'Creator layout', bio: 'A short introduction to the creator.', cardGlow: true, buttonGlow: true, rounded: false,
      links: Array.from({length:8},(_,index)=>({id:`link-${index}`,title:`Creator link ${index+1}`,url:`https://example.com/${index}`})),
      offers: Array.from({length:8},(_,index)=>({id:`offer-${index}`,type:'digital',title:`Creator offer ${index+1}`,description:'A resource with a description, price, and access link.',price:'25.5',url:`https://example.com/offer/${index}`,billingPeriod:'session'})),
      socials: {instagram:'https://instagram.com/example',youtube:'https://youtube.com/@example',x:'https://x.com/example'} };
    expect((await db.from('cards_users').insert({username:alias,wallet_address:Keypair.generate().publicKey.toBase58(),display_name:design.name,bio:design.bio,design,published:true})).error).toBeNull();
    await page.goto(`/${alias}`);
    const card = page.locator('[data-testid="creator-card"]:visible'), details = page.locator('[data-testid="creator-details"]:visible');
    await expect(card.getByRole('heading',{name:design.name,exact:true})).toBeVisible();
    await expect(card.getByRole('link')).toHaveCount(4);
    await expect(card.getByRole('button')).toHaveCount(1);
    await expect(details.getByRole('link',{name:/^Creator link/})).toHaveCount(7);
    await expect(details.getByRole('button',{name:/^Creator offer/})).toHaveCount(8);
    await expect(card.getByRole('link',{name:'Instagram',exact:true})).toBeVisible();
    await expect(details.getByRole('navigation',{name:'Creator social links'})).toHaveCount(0);
    await expect(details.getByRole('button',{name:'Tips USDC',exact:true})).toBeVisible();
    await expect(card.getByRole('button',{name:'Share creator page',exact:true})).toBeVisible();
    await expect(card.getByRole('link',{name:'Creator link 1',exact:true})).toHaveAttribute('href','https://example.com/0');
    const firstLink = details.getByRole('link',{name:'Creator link 2',exact:true});
    expect(await firstLink.evaluate(element=>getComputedStyle(element).boxShadow)).not.toBe('none');
    expect(await firstLink.evaluate(element=>parseFloat(getComputedStyle(element).borderRadius))).toBeLessThan(8);
    if (theme==='light') expect(await firstLink.evaluate(element=>getComputedStyle(element).color)).toBe('rgb(24, 24, 27)');
    for (const width of [320,390,1280]) {
      await page.setViewportSize({width,height:900});
      await page.mouse.move(0,0);
      await expect.poll(()=>card.evaluate(element=>getComputedStyle(element).transform)).toBe('none');
      await expect(card).toHaveCount(1);
      await expect(details).toHaveCount(1);
      const identity = (await card.boundingBox())!, content = (await details.boundingBox())!;
      expect(content.y).toBeGreaterThan(identity.y+identity.height);
      expect(identity.height/identity.width).toBeCloseTo(1.618,1);
      const socials = (await card.getByRole('navigation',{name:'Creator social links'}).boundingBox())!;
      expect(socials.y+socials.height).toBeLessThan(identity.y+identity.height);
      expect(socials.y).toBeGreaterThan((await card.getByRole('heading').boundingBox())!.y);
      const tabs = (await details.getByRole('navigation',{name:'Creator website links'}).boundingBox())!;
      const firstOffer = (await details.getByRole('button',{name:/^Creator offer 1 /}).boundingBox())!;
      expect(tabs.y+tabs.height).toBeLessThan(firstOffer.y);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
    const stage = card.locator('..'), frame = (await stage.boundingBox())!;
    for (const [x,y,component,sign] of [[0.85,0.5,'m13',-1],[0.15,0.5,'m13',1],[0.5,0.15,'m23',1],[0.5,0.85,'m23',-1]] as const) {
      await page.mouse.move(frame.x+frame.width*x,frame.y+frame.height*y);
      await expect.poll(()=>card.evaluate((element,{component,sign})=>{
        const matrix=new DOMMatrix(getComputedStyle(element).transform);
        return matrix[component]*sign;
      },{component,sign})).toBeGreaterThan(0.02);
      expect(await stage.evaluate(element=>parseFloat((element as HTMLElement).style.getPropertyValue('--card-press-z')))).toBeLessThan(0);
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    await expect.poll(()=>card.evaluate(element=>getComputedStyle(element).transform)).toBe('none');
    await page.mouse.move(0,0);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.setViewportSize({width:390,height:844});
    expect((await new AxeBuilder({page}).include('[data-testid=creator-details]').include('[data-testid=creator-card]').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
    await details.getByRole('button',{name:'Tips USDC',exact:true}).click();
    await expect(page.getByRole('dialog',{name:`Tip @${alias}`,exact:true})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({path:testInfo.outputPath(`creator-details-${theme}.png`),fullPage:true});
  }
});
