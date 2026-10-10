import test from 'node:test';
import assert from 'node:assert/strict';
import sitemapModule from '../app/sitemap.ts';
import robotsModule from '../app/robots.ts';
import { creatorStructuredData, jsonLd, PRIVATE_METADATA } from '../lib/seo.ts';
import { EMPTY_DRAFT } from '../lib/creator-draft.ts';

const sitemap = typeof sitemapModule === 'function' ? sitemapModule : sitemapModule.default;
const robots = typeof robotsModule === 'function' ? robotsModule : robotsModule.default;

test('profile structured data preserves user text without allowing script injection', () => {
  const creator = { alias: 'alice', design: { ...EMPTY_DRAFT, name: 'Alice </script><script>alert(1)</script>', bio: 'Artist', socials: { x: 'https://x.com/alice', youtube: 'javascript:alert(1)', instagram: '' } } };
  const data = creatorStructuredData(creator);
  assert.equal(data['@type'], 'ProfilePage');
  assert.equal(data.mainEntity.alternateName, '@alice');
  assert.deepEqual(data.mainEntity.sameAs, ['https://x.com/alice']);
  const encoded = jsonLd(data);
  assert.equal(encoded.includes('</script>'), false);
  assert.equal(JSON.parse(encoded).mainEntity.name, creator.design.name);
});

test('account pages are noindex for all crawlers including Googlebot', () => {
  assert.equal(PRIVATE_METADATA.robots.index, false);
  assert.equal(PRIVATE_METADATA.robots.googleBot.index, false);
});

test('sitemap paginates published profiles, skips invalid aliases, and uses real modification dates', async () => {
  const keys = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'NEXT_PUBLIC_APP_URL'];
  const previous = keys.map(key => process.env[key]);
  const oldFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://seo-test.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-key';
  process.env.NEXT_PUBLIC_APP_URL = 'https://vynx.example';
  const requests = [];
  globalThis.fetch = async input => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push(url);
    assert.equal(url.searchParams.get('published'), 'eq.true');
    assert.equal(url.searchParams.get('select'), 'username,display_name,bio,updated_at');
    assert.equal(url.searchParams.get('order'), 'username.asc');
    const rows = requests.length === 1
      ? Array.from({ length: 1000 }, (_, i) => ({ username: i === 999 ? 'api' : `creator_${i}`, updated_at: '2026-10-01T00:00:00Z' }))
      : [{ username: 'last_creator', updated_at: '2026-10-02T00:00:00Z' }];
    return new Response(JSON.stringify(rows), { headers: { 'content-type': 'application/json' } });
  };
  try {
    const entries = await sitemap();
    assert.equal(requests.length, 2);
    assert.equal(requests[1].searchParams.get('offset'), '1000');
    assert.equal(entries.length, 1001);
    assert.equal(entries[0].url, 'https://vynx.example/');
    assert.equal(entries.at(-1).url, 'https://vynx.example/last_creator');
    assert.equal(entries.at(-1).lastModified, '2026-10-02T00:00:00Z');
    assert.equal(robots().sitemap, 'https://vynx.example/sitemap.xml');
    assert.equal(robots().rules.disallow.includes('/dashboard/'), false); // Crawlers must read the noindex tag.
    globalThis.fetch = async () => new Response(JSON.stringify({ message: 'offline' }), { status: 503 });
    await assert.rejects(sitemap(), /listing is unavailable/); // Never serve an incomplete sitemap as a success.
  } finally {
    globalThis.fetch = oldFetch;
    keys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; });
  }
});
