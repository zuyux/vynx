import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { validatedCreatorImage, ownedCreatorImagePath, persistCreatorImage } from '../lib/creator-images.ts';
import { publicationFields, EMPTY_DRAFT } from '../lib/creator-draft.ts';
const wallet = '11111111111111111111111111111111';
const base = 'https://images.supabase.co';
const path = `${wallet}/12345678-1234-4123-8123-123456789abc.png`;
const url = `${base}/storage/v1/object/public/creator-images/${path}`;
const dataUrl = (format, bytes) => `data:image/${format};base64,${bytes.toString('base64')}`;
async function raster(format = 'png', width = 2, height = 2) {
  return sharp({ create: { width, height, channels: 3, background: '#aabbcc' } }).toFormat(format).toBuffer();
}
test('image validation decodes supported raster formats and strips metadata', async () => {
  for (const format of ['png', 'jpeg', 'webp']) {
    const result = await validatedCreatorImage(dataUrl(format, await raster(format)));
    assert.equal(result.contentType, `image/${format}`);
    assert.equal((await sharp(result.bytes).metadata()).format, format);
  }
});
test('server rejects spoofed MIME types, SVG, truncated rasters, oversize and excessive dimensions', async () => {
  const png = await raster();
  for (const value of [dataUrl('jpeg', png), dataUrl('png', Buffer.from('<svg/>')), dataUrl('png', png.subarray(0, 40)), dataUrl('svg+xml', Buffer.from('<svg/>')), dataUrl('png', Buffer.alloc(1024 * 1024 + 1)), dataUrl('png', await raster('png', 6001, 1))]) {
    await assert.rejects(validatedCreatorImage(value));
  }
});
test('stored references must use the configured origin and wallet, with canonical object paths', () => {
  assert.equal(ownedCreatorImagePath(url, wallet, base), path);
  for (const value of [url.replace(base, 'https://evil.example'), url + '?download=1', url + '#x', url.replace(wallet, '22222222222222222222222222222222'), url.replace('.png', '.svg'), url.replace('12345678-', '../12345678-')]) {
    assert.equal(ownedCreatorImagePath(value, wallet, base), null);
  }
  assert.equal(publicationFields({ ...EMPTY_DRAFT, alias: 'alice', name: 'Alice', avatar: url }).avatar, url);
});
test('saving uploads new bytes with immutable names and retains only the current owned image', async () => {
  const oldUrl = process.env.SUPABASE_URL; process.env.SUPABASE_URL = base;
  const uploaded = []; let captured;
  const db = { from: () => ({ upsert: async () => ({ error: null }) }), storage: { from: () => ({ upload: async (...args) => { captured = args; return { error: null }; }, getPublicUrl: key => ({ data: { publicUrl: `${base}/storage/v1/object/public/creator-images/${key}` } }) }) } };
  try {
    assert.equal(await persistCreatorImage(db, wallet, '', url, uploaded), '');
    assert.equal(await persistCreatorImage(db, wallet, url, url, uploaded), url);
    await assert.rejects(persistCreatorImage(db, wallet, url, '', uploaded), /current saved profile/);
    const result = await persistCreatorImage(db, wallet, dataUrl('png', await raster()), null, uploaded);
    assert.match(result, /\/creator-images\//);
    assert.equal(uploaded.length, 1);
    assert.equal(captured[0], uploaded[0]);
    assert.deepEqual(captured[2], { contentType: 'image/png', cacheControl: '31536000', upsert: false });
  } finally { if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl; }
});
test('storage failures preserve the draft and leave uploaded paths uncommitted', async () => {
  const uploaded = [];
  const db = { from: () => ({ upsert: async () => ({ error: null }) }), storage: { from: () => ({ upload: async () => ({ error: { message: 'secret internals' } }), getPublicUrl: key => ({ data: { publicUrl: `${base}/storage/v1/object/public/creator-images/${key}` } }) }) } };
  await assert.rejects(persistCreatorImage(db, wallet, dataUrl('png', await raster()), null, uploaded), error => error.status === 503 && !error.message.includes('secret internals'));
  assert.deepEqual(uploaded, []);

});
