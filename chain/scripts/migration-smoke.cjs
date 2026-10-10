// Disposable devnet test only; does not create a Supabase claim or attest a real purchase.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Connection, Keypair, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const c = require('./client.cjs');
async function main() {
  const connection = new Connection(process.env.VYNX_DEVNET_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
  assert.equal(await connection.getGenesisHash(), 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG');
  const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(process.env.VYNX_DEPLOYER_KEYPAIR || path.join(__dirname, '../.wallets/devnet-deployer.json'), 'utf8'))));
  const config = c.decodeConfig(await connection.getAccountInfo(c.configPda()));
  assert(config.admin.equals(admin.publicKey));
  const owner = Keypair.generate();
  const alias = `mig_${randomBytes(8).toString('hex')}`;
  async function send(ix, signers = []) {
    const tx = new Transaction({ feePayer: admin.publicKey, ...await connection.getLatestBlockhash('confirmed') }).add(ix);
    return sendAndConfirmTransaction(connection, tx, [admin, ...signers], { commitment: 'finalized' });
  }
  let signature;
  try {
    if (!config.paused) await send(c.adminIx('set_paused', admin.publicKey, Buffer.from([1])));
    const before = await connection.getBalance(owner.publicKey);
    const treasuryBefore = await connection.getBalance(config.treasury);
    const claimId = randomBytes(16);
    signature = await send(c.migrateIx(admin.publicKey, owner.publicKey, alias, BigInt(await connection.getSlot('confirmed')) + 120n, claimId), [owner]);
    const record = c.decodeAlias(await connection.getAccountInfo(c.aliasPda(alias)));
    assert(record.owner.equals(owner.publicKey));
    assert.equal(record.alias, alias);
    assert.equal(record.paidLamports, 0n);
    assert.equal(record.priceVersion, 0n);
    const index = await connection.getAccountInfo(c.ownerPda(owner.publicKey));
    assert(index.owner.equals(c.PROGRAM_ID));
    assert(Buffer.from(index.data).subarray(8, 40).equals(owner.publicKey.toBuffer()));
    assert(Buffer.from(index.data).subarray(40, 72).equals(c.aliasPda(alias).toBuffer()));
    assert.equal(await connection.getBalance(owner.publicKey), before);
    assert.equal(await connection.getBalance(config.treasury), treasuryBefore);
    const evidence = { network: 'devnet', programId: c.PROGRAM_ID.toBase58(), signature, alias, owner: owner.publicKey.toBase58(), creatorChargeLamports: 0, treasuryPaymentLamports: 0, verifiedAt: new Date().toISOString(), disposableTest: true };
    fs.writeFileSync(path.join(__dirname, '../devnet-migration-smoke.json'), JSON.stringify(evidence, null, 2) + '\n');
    console.log(JSON.stringify(evidence));
  } finally {
    if (!config.paused) await send(c.adminIx('set_paused', admin.publicKey, Buffer.from([0])));
    assert.equal(c.decodeConfig(await connection.getAccountInfo(c.configPda())).paused, config.paused);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
