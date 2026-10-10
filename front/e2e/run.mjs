import { spawn, spawnSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { Keypair } from '@solana/web3.js';
import { fixtureServer } from './fixture-server.mjs';

const suffix = `${process.pid}`;
const network = `vynx-e2e-${suffix}`;
const postgres = `${network}-db`;
const rest = `${network}-rest`;
const dbPort = 43127;
const fixturePort = 43130;
const appPort = 43131;
const localPassword = randomBytes(24).toString('hex');
const jwtSecret = randomBytes(32).toString('hex');
function token(role) {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const payload = `${head}.${body}`;
  return `${payload}.${createHmac('sha256', jwtSecret).update(payload).digest('base64url')}`;
}
function docker(args, options = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8', ...options });
  if (result.status !== 0) throw new Error(result.stderr || `docker ${args[0]} failed`);
  return result.stdout;
}
const registry = process.env.E2E_ALIAS_REGISTRY === '1';
const sponsor = Keypair.generate();
const env = { ...process.env, VYNX_ALIAS_REGISTRY_ENABLED: String(registry), VYNX_ALIAS_SPONSOR_KEYPAIR_PATH: '', VYNX_ALIAS_SPONSOR_SECRET_KEY: registry ? JSON.stringify(Array.from(sponsor.secretKey)) : '', SUPABASE_URL: `http://127.0.0.1:${fixturePort}`, SUPABASE_ANON_KEY: token('anon'), SUPABASE_SECRET_KEY: token('service_role'), NEXT_PUBLIC_TREASURY_WALLET: Keypair.generate().publicKey.toBase58(), NEXT_PUBLIC_SOLANA_RPC_URL: `http://127.0.0.1:${fixturePort}/rpc`, NEXT_PUBLIC_APP_URL: `http://localhost:${appPort}`, NEXT_PUBLIC_PHANTOM_APP_ID: '', KORA_RPC_URL: `http://127.0.0.1:${fixturePort}/kora`, KORA_API_KEY: '', E2E_BASE_URL: `http://localhost:${appPort}`, E2E_FIXTURE_URL: `http://127.0.0.1:${fixturePort}` };
let fixture;
let application;
async function run(command, args) {
  const child = spawn(command, args, { env, stdio: 'inherit' });
  return new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))); });
}
try {
  docker(['network', 'create', network]);
  docker(['run', '-d', '--name', postgres, '--network', network, '-e', `POSTGRES_PASSWORD=${localPassword}`, 'postgres:17-alpine']);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (spawnSync('docker', ['exec', postgres, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']).status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Test Postgres did not become ready.');
  const bootstrap = `create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create role authenticator login password '${localPassword}'; grant anon, authenticated, service_role to authenticator; grant usage on schema public to anon, authenticated, service_role; alter default privileges in schema public grant all on tables to service_role;`;
  docker(['exec', '-i', postgres, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: bootstrap });
  for (const file of fs.readdirSync('supabase/migrations').filter(file => file.endsWith('.sql')).sort()) {
    docker(['exec', '-i', postgres, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: fs.readFileSync(`supabase/migrations/${file}`, 'utf8') });
  }
  console.log('All migrations applied to isolated Postgres.');
  docker(['run', '-d', '--name', rest, '--network', network, '-p', `127.0.0.1:${dbPort}:3000`, '-e', `PGRST_DB_URI=postgres://authenticator:${localPassword}@${postgres}:5432/postgres`, '-e', 'PGRST_DB_SCHEMAS=public', '-e', 'PGRST_DB_ANON_ROLE=anon', '-e', `PGRST_JWT_SECRET=${jwtSecret}`, 'postgrest/postgrest:v13.0.7']);
  let restReady = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(`http://127.0.0.1:${dbPort}/`)).ok) { restReady = true; break; } } catch { /* Wait for PostgREST schema initialization. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!restReady) throw new Error('Test PostgREST did not become ready.');
  fixture = await fixtureServer(`http://127.0.0.1:${dbPort}`, registry ? { sponsor, treasury: env.NEXT_PUBLIC_TREASURY_WALLET } : undefined, env.SUPABASE_SECRET_KEY);
  await new Promise((resolve, reject) => { fixture.once('error', reject); fixture.listen(fixturePort, '127.0.0.1', resolve); });
  // Public env values are compiled into client bundles; build with the isolated configuration.
  await run('npm', ['run', 'build']);
  application = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', String(appPort)], { env, stdio: 'inherit' });
  let appReady = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(env.E2E_BASE_URL)).ok) { appReady = true; break; } } catch { /* Wait for Next startup. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!appReady) throw new Error('Test application did not become ready.');
  await run(process.execPath, ['node_modules/@playwright/test/cli.js', 'test']);
} catch (reason) { console.error(reason.message); process.exitCode = 1; }
finally {
  application?.kill();
  if (application) await new Promise(resolve => { if (application.exitCode !== null) resolve(); else application.once('exit', resolve); });
  if (fixture) await new Promise(resolve => fixture.close(resolve));
  spawnSync('docker', ['rm', '-f', rest, postgres], { stdio: 'ignore' });
  spawnSync('docker', ['network', 'rm', network], { stdio: 'ignore' });
}
