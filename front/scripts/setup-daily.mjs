import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;

// Run from front/. The generated secret is saved locally and never printed.
loadEnvConfig(process.cwd());
const path = '.env.local';
if (!process.env.DAILY_WEBHOOK_HMAC_BASE64) {
  let source = readFileSync(path, 'utf8');
  const secret = randomBytes(32).toString('base64');
  source = source.replace(/^DAILY_WEBHOOK_HMAC_BASE64=.*\n?/m, '');
  writeFileSync(path, `${source.trimEnd()}\nDAILY_WEBHOOK_HMAC_BASE64=${secret}\n`, { mode: 0o600 });
  chmodSync(path, 0o600); process.env.DAILY_WEBHOOK_HMAC_BASE64 = secret;
  console.info('Saved the Daily webhook secret in .env.local. Restart the app and copy it to the hosting environment before registering.');
}
if (!process.argv.includes('--register')) process.exit(0);
if (!process.env.DAILY_API_KEY) throw new Error('Save DAILY_API_KEY in .env.local first.');
const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost');
if (origin.protocol !== 'https:' || ['localhost','127.0.0.1'].includes(origin.hostname)) throw new Error('Registration requires NEXT_PUBLIC_APP_URL to be the public HTTPS app or tunnel URL.');
const url = new URL('/api/daily/webhook', origin).href;
async function daily(path, body) {
  const response = await fetch(`https://api.daily.co/v1/${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}`, 'Content-Type': 'application/json' }, ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(20_000) });
  // Provider responses can contain the webhook secret. Never print them on failure.
  if (!response.ok) throw new Error(`Daily setup failed (${response.status}); verify credentials and that the app accepts the signed setup probe.`);
  return response.json();
}
const list = await daily('webhooks');
const hooks = Array.isArray(list) ? list : list.data;
if (!Array.isArray(hooks)) throw new Error('Unexpected Daily webhook list response.');
const existing = hooks.find(hook => hook.url === url);
const hook = await daily(existing ? `webhooks/${encodeURIComponent(existing.uuid)}` : 'webhooks', {
  url, hmac: process.env.DAILY_WEBHOOK_HMAC_BASE64, retryType: 'exponential',
  eventTypes: ['meeting.started','meeting.ended','participant.joined','participant.left'],
});
if (hook.state !== 'ACTIVE') throw new Error('Daily webhook is not active.');
console.info('Daily webhook is active; signed endpoint verification passed.');
