import test from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../app/api/auth/config/route.ts';

test('public auth configuration exposes only the runtime app ID and never caches credentials', async () => {
  const savedId = process.env.PRIVY_APP_ID, savedSecret = process.env.PRIVY_APP_SECRET;
  try {
    process.env.PRIVY_APP_ID = ' runtime-app-id ';
    process.env.PRIVY_APP_SECRET = 'private-secret';
    const response = await GET(new Request('https://vynx.test/api/auth/config'));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { privyAppId: 'runtime-app-id' });
    process.env.PRIVY_APP_ID = '';
    assert.deepEqual(await (await GET(new Request('https://vynx.test/api/auth/config'))).json(), { privyAppId: null });
  } finally {
    if (savedId === undefined) delete process.env.PRIVY_APP_ID; else process.env.PRIVY_APP_ID = savedId;
    if (savedSecret === undefined) delete process.env.PRIVY_APP_SECRET; else process.env.PRIVY_APP_SECRET = savedSecret;
  }
});
