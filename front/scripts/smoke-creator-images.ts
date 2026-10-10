// Live preview test with a disposable devnet creator. Never uses an existing creator's session.
import assert from 'node:assert/strict';
import { createPrivateKey, sign, randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { Keypair, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { appDb } from '../lib/app-db';
import { aliasConnection } from '../lib/alias-network';
import { CREATOR_IMAGE_BUCKET } from '../lib/creator-image-policy';
import { ownedCreatorImagePath, removeUncommittedImages } from '../lib/creator-images';
import { EMPTY_DRAFT } from '../lib/creator-draft';

async function main() {
  const deployment = new URL(process.argv[2]);
  assert.equal(deployment.protocol, 'https:');
  assert(deployment.hostname.endsWith('.vercel.app'));
  const connection = await aliasConnection(); // Refuses non-devnet RPCs before funding.
  const db = appDb();
  const { error: migrationError } = await db.from('creator_image_cleanup').select('state').limit(1);
  assert.equal(migrationError, null, 'Apply migration 007 before running the hosted image cleanup test.');
  const owner = Keypair.generate();
  const wallet = owner.publicKey.toBase58();
  const alias = `img_${randomBytes(8).toString('hex')}`;
  const origin = new URL(process.argv[3] || process.env.NEXT_PUBLIC_APP_URL!).origin;
  const directory = mkdtempSync(join(tmpdir(), 'vynx-image-smoke-'));
  const cookies = join(directory, 'cookies');
  const execute = promisify(execFile);
  const paths: string[] = [];
  async function request(path: string, method = 'GET', body?: unknown, authenticated = true) {
    const file = join(directory, 'body.json');
    const config = join(directory, 'request.conf');
    if (body !== undefined) writeFileSync(file, JSON.stringify(body), { mode: 0o600 });
    writeFileSync(config, `header = ${JSON.stringify(`Origin: ${origin}`)}\nheader = "Content-Type: application/json"\n`, { mode: 0o600 });
    const args = ['curl', path, '--deployment', deployment.origin, '--', '--silent', '--show-error', '--config', config, '--request', method, '--cookie-jar', cookies, '--write-out', '\n%{http_code}', ...(authenticated ? ['--cookie', cookies] : []), ...(body !== undefined ? ['--data-binary', `@${file}`] : [])];
    const { stdout } = await execute('vercel', args, { maxBuffer: 5_000_000 });
    const split = stdout.lastIndexOf('\n');
    const status = Number(stdout.slice(split + 1));
    const raw = stdout.slice(0, split);
    let data;
    try { data = JSON.parse(raw); } catch { data = null; }
    return { status, data, raw };
  }
  try {
    const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.env.VYNX_DEPLOYER_KEYPAIR || '../chain/.wallets/devnet-deployer.json', 'utf8'))));
    const nonce = await request('/api/auth/nonce', 'POST', { wallet });
    assert.equal(nonce.status, 200, nonce.data?.error);
    const secret = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(owner.secretKey.slice(0, 32))]), format: 'der', type: 'pkcs8' });
    const session = await request('/api/auth/session', 'POST', { id: nonce.data.id, wallet, signature: sign(null, Buffer.from(nonce.data.message), secret).toString('hex') });
    assert.equal(session.status, 200, session.data?.error);
    await sendAndConfirmTransaction(connection, new Transaction().add(SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: owner.publicKey, lamports: 20_000_000 })), [admin], { commitment: 'confirmed' });
    const quote = await request(`/api/actions/claim-alias?alias=${alias}`);
    assert.equal(quote.status, 200, quote.data?.error);
    const prepared = await request(`/api/actions/claim-alias?alias=${alias}`, 'POST', { account: wallet, priceLamports: quote.data.priceLamports, priceVersion: quote.data.priceVersion });
    assert.equal(prepared.status, 200, prepared.data?.error);
    const tx = Transaction.from(Buffer.from(prepared.data.transaction, 'base64'));
    tx.partialSign(owner);
    const signature = await connection.sendRawTransaction(tx.serialize());
    const confirmation = await connection.confirmTransaction({ signature, blockhash: prepared.data.blockhash, lastValidBlockHeight: prepared.data.lastValidBlockHeight }, 'confirmed');
    assert.equal(confirmation.value.err, null);
    const claim = await request(`/api/actions/claim-alias/confirm?alias=${alias}`, 'POST', { account: wallet, signature });
    assert.equal(claim.status, 200, claim.data?.error);
    const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#32cfa2' } }).png().toBuffer();
    const design = { ...EMPTY_DRAFT, alias, name: 'Disposable image upload test', avatar: `data:image/png;base64,${png.toString('base64')}` };
    const payload = { design, published: true, tips_enabled: false };
    const saved = await request('/api/profile', 'PATCH', payload);
    assert.equal(saved.status, 200, saved.data?.error);
    const imageUrl = saved.data.profile.design.avatar;
    assert(!imageUrl.startsWith('data:'));
    const objectPath = ownedCreatorImagePath(imageUrl, wallet, process.env.SUPABASE_URL!);
    assert(objectPath); paths.push(objectPath);
    const image = await fetch(imageUrl);
    assert.equal(image.status, 200);
    assert.match(image.headers.get('content-type')!, /^image\/png/);
    assert.equal((await sharp(Buffer.from(await image.arrayBuffer())).metadata()).width, 32);
    const retained = await request('/api/profile', 'PATCH', { ...payload, design: { ...saved.data.profile.design, bio: 'Storage URL retained on subsequent save.' } });
    assert.equal(retained.status, 200, retained.data?.error);
    assert.equal(retained.data.profile.design.avatar, imageUrl);
    const publicPage = await request(`/${alias}`);
    assert.equal(publicPage.status, 200);
    assert(publicPage.raw.includes(imageUrl));
    const replaced = await request('/api/profile', 'PATCH', { ...payload, design: { ...retained.data.profile.design, avatar: design.avatar } });
    assert.equal(replaced.status, 200, replaced.data?.error);
    const replacementUrl = replaced.data.profile.design.avatar;
    const replacementPath = ownedCreatorImagePath(replacementUrl, wallet, process.env.SUPABASE_URL!);
    assert(replacementPath); paths.push(replacementPath);
    assert.notEqual(replacementUrl, imageUrl);
    const oldObject = await db.storage.from(CREATOR_IMAGE_BUCKET).list(wallet, { search: objectPath.split('/')[1] });
    assert.equal(oldObject.error, null);
    assert.equal(oldObject.data?.some(object => object.name === objectPath.split('/')[1]), false);
    assert.equal((await fetch(replacementUrl)).status, 200);
    const removed = await request('/api/profile', 'PATCH', { ...payload, design: { ...replaced.data.profile.design, avatar: '' } });
    assert.equal(removed.status, 200, removed.data?.error);
    const removedObject = await db.storage.from(CREATOR_IMAGE_BUCKET).list(wallet, { search: replacementPath.split('/')[1] });
    assert.equal(removedObject.error, null);
    assert.equal(removedObject.data?.some(object => object.name === replacementPath.split('/')[1]), false);
    const invalid = await request('/api/profile', 'PATCH', { ...payload, design: { ...design, avatar: 'data:image/png;base64,AAAA' } });
    assert.equal(invalid.status, 400);
    // Separate cookie jar prevents this negative check from clearing our valid session.
    const originalCookie = readFileSync(cookies);
    const anonymous = await request('/api/profile', 'PATCH', payload, false);
    writeFileSync(cookies, originalCookie, { mode: 0o600 });
    assert.equal(anonymous.status, 401);
    console.log(JSON.stringify({ verifiedAt: new Date().toISOString(), deployment: deployment.origin, network: 'devnet', alias, owner: wallet, claimSignature: signature, checks: ['wallet-authenticated-upload', 'public-image-read', 'URL-persistence', 'public-card', 'corrupt-file-rejection', 'anonymous-rejection', 'replacement-object-deleted', 'removed-object-deleted'], disposableTest: true }));
  } finally {
    // Delete only this disposable profile and its image/session fixtures. The
    // immutable on-chain alias and sponsored payment audit remain on devnet.
    const { data: current, error: lookupError } = await db.from('cards_users').select('avatar_url,banner_url').eq('wallet_address', wallet).maybeSingle();
    if (!lookupError && current) for (const value of [current.avatar_url, current.banner_url]) {
      const path = value ? ownedCreatorImagePath(value, wallet, process.env.SUPABASE_URL!) : null;
      if (path && !paths.includes(path)) paths.push(path);
    }
    assert.equal((await db.from('cards_users').delete().eq('wallet_address', wallet).eq('username', alias)).error, null);
    await removeUncommittedImages(db, paths);
    assert.equal((await db.from('wallet_sessions').delete().eq('wallet', wallet)).error, null);
    assert.equal((await db.from('wallet_nonces').delete().eq('wallet', wallet)).error, null);
    rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(reason => { console.error(reason instanceof Error ? reason.message : 'Image smoke test failed.'); process.exitCode = 1; });
