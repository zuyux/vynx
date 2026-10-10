import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { creatorOgImage, ogPortrait } from '../lib/creator-og.tsx';
import { EMPTY_DRAFT } from '../lib/creator-draft.ts';

test('creator preview renders a 1200×630 PNG with and without a portrait', async () => {
  const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#a855f7' } }).webp().toBuffer();
  const portrait = await ogPortrait(`data:image/webp;base64,${bytes.toString('base64')}`);
  assert.ok(portrait?.startsWith('data:image/png;base64,'));
  for (const image of [portrait, null]) {
    const response = creatorOgImage({ alias: 'creator', design: { ...EMPTY_DRAFT, name: 'Creator ✨', bio: 'A creator on Solana.', alias: 'creator' } }, image);
    const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, 1200);
    assert.equal(metadata.height, 630);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('missing, broken, and external portraits fall back safely', async () => {
  assert.equal(await ogPortrait(''), null);
  assert.equal(await ogPortrait('data:image/png;base64,AAAA'), null);
  assert.equal(await ogPortrait('https://example.com/portrait.png'), null);
});
