// Loads the authorized development wallet only from the local environment.
// Key material stays in memory and is never included in evidence files/output.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bs58Module = require('bs58');
const bs58 = bs58Module.default || bs58Module;
const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js');
const { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction } = require('@solana/spl-token');
const c = require('./booking-client.cjs');
const MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const EVIDENCE = 'booking-devnet-funding-smoke.json';
function testWallet() {
  const phrase = process.env.TESTNET_PRIVATE_KEY?.trim().normalize('NFKD');
  if (!phrase || phrase.split(/\s+/).length !== 12) throw Error('Expected configured development recovery phrase.');
  const seed = crypto.pbkdf2Sync(phrase, 'mnemonic', 2048, 64, 'sha512');
  let derived = crypto.createHmac('sha512', 'ed25519 seed').update(seed).digest();
  for (const index of [44, 501, 1, 0]) {
    const data = Buffer.alloc(37); derived.subarray(0, 32).copy(data, 1); data.writeUInt32BE(index + 0x80000000, 33);
    derived = crypto.createHmac('sha512', derived.subarray(32)).update(data).digest();
  }
  const wallet = Keypair.fromSeed(derived.subarray(0, 32));
  if (wallet.publicKey.toBase58() !== process.env.TESTNET_ADDRESS?.trim()) throw Error('Development wallet derivation does not match configured address.');
  return wallet;
}
(async () => {
  const connection = new Connection(process.env.VYNX_DEVNET_RPC_URL || 'https://api.devnet.solana.com', { commitment: 'finalized', disableRetryOnRateLimit: true });
  assert.equal(await connection.getGenesisHash(), 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG', 'Devnet required');
  const payer = testWallet();
  const load = name => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(`.wallets/${name}.json`))));
  const quote = load('booking-devnet-quote'), creator = load('devnet-creator');
  const config = await connection.getAccountInfo(c.config(), 'finalized');
  assert(config?.owner.equals(c.PROGRAM_ID));
  assert.equal(new PublicKey(config.data.subarray(8, 40)).toBase58(), quote.publicKey.toBase58());
  assert.equal(new PublicKey(config.data.subarray(72, 104)).toBase58(), MINT.toBase58());
  const pd = await connection.getAccountInfo(c.programDataPda(), 'finalized'), binary = fs.readFileSync('target/deploy/vynx_booking.so');
  assert(pd?.owner.equals(c.LOADER) && pd.data.subarray(45, 45 + binary.length).equals(binary), 'Deployed binary mismatch');
  const source = getAssociatedTokenAddressSync(MINT, payer.publicKey), destination = getAssociatedTokenAddressSync(MINT, creator.publicKey);
  const balance = async () => BigInt((await connection.getTokenAccountBalance(source, 'finalized')).value.amount);
  const initialUsdc = await balance(), initialSol = await connection.getBalance(payer.publicKey, 'finalized');
  assert(initialUsdc >= 10000n && initialSol >= 10000000, 'Insufficient test funds');
  // Preserve one operation across retries/timeouts. Never create a fresh booking
  // when a previous submission might already have landed.
  let record = fs.existsSync(EVIDENCE) ? JSON.parse(fs.readFileSync(EVIDENCE)) : null;
  if (record?.completed) {
    assert.equal(record.payer, payer.publicKey.toBase58());
    const id = Buffer.from(record.id, 'hex');
    const receipt = await connection.getAccountInfo(c.booking(id), 'finalized');
    assert(receipt?.owner.equals(c.PROGRAM_ID) && receipt.data[216] === 3, 'Completed receipt mismatch');
    assert.equal((await connection.getTokenAccountBalance(c.vault(id), 'finalized')).value.amount, '0');
    console.log('Existing completed live escrow receipt verified; no new payment submitted.'); return;
  }
  if (record) assert.equal(record.payer, payer.publicKey.toBase58());
  else {
    const clock = await connection.getAccountInfo(new PublicKey('SysvarC1ock11111111111111111111111111111111'), 'finalized');
    const now = Number(clock.data.readBigInt64LE(32)), id = crypto.randomBytes(16);
    record = { network: 'devnet', programId: c.PROGRAM_ID.toBase58(), payer: payer.publicKey.toBase58(), creator: creator.publicKey.toBase58(), id: id.toString('hex'), mint: MINT.toBase58(), source: source.toBase58(), receipt: c.booking(id).toBase58(), vault: c.vault(id).toBase58(), amountUnits: '10000', start: now + 2 * 86400, end: now + 2 * 86400 + 1800, expires: now + 600, initialUsdcUnits: initialUsdc.toString(), initialSolLamports: initialSol, termsHash: crypto.createHash('sha256').update('vynx:live-devnet-escrow-funding-refund:' + id.toString('hex')).digest('hex') };
  }
  const save = () => fs.writeFileSync(EVIDENCE, JSON.stringify(record, null, 2) + '\n'); save();
  const id = Buffer.from(record.id, 'hex');
  const fund = c.fund({ payer: payer.publicKey, quote: quote.publicKey, creator: creator.publicKey, mint: MINT, source, id, hash: Buffer.from(record.termsHash, 'hex'), amount: 10000n, start: record.start, end: record.end, expires: record.expires });
  const refund = c.settlement('refund', payer.publicKey, id, MINT, source, destination);
  async function submit(name, instructions, signers) {
    const latest = await connection.getLatestBlockhash('finalized');
    const tx = new Transaction({ feePayer: payer.publicKey, ...latest }).add(...instructions); tx.sign(...signers);
    const signature = bs58.encode(tx.signature); record[`${name}Signature`] = signature; save();
    await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, preflightCommitment: 'finalized', maxRetries: 3 });
    const result = await connection.confirmTransaction({ ...latest, signature }, 'finalized');
    assert.equal(result.value.err, null, `${name} transaction failed`);
    console.log(JSON.stringify({ phase: name, signature }));
  }
  async function simulate(instruction, signers) {
    const latest = await connection.getLatestBlockhash('finalized');
    const tx = new Transaction({ feePayer: payer.publicKey, ...latest }).add(instruction); tx.sign(...signers);
    return (await connection.simulateTransaction(tx)).value;
  }
  try {
    let receipt = await connection.getAccountInfo(c.booking(id), 'finalized');
    if (!receipt && !record.fundSignature) {
      await submit('fund', [createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, destination, creator.publicKey, MINT), fund], [payer, quote]);
      receipt = await connection.getAccountInfo(c.booking(id), 'finalized');
    }
    assert(receipt?.owner.equals(c.PROGRAM_ID), 'Receipt unavailable; reconcile saved funding signature before retrying');
    if (receipt.data[216] === 1) {
      assert.equal(await balance(), BigInt(record.initialUsdcUnits) - 10000n);
      assert.equal((await connection.getTokenAccountBalance(c.vault(id), 'finalized')).value.amount, '10000');
      const d = receipt.data;
      assert.equal(d.length, 226); assert(d.subarray(8, 24).equals(id)); assert(d.subarray(24, 56).equals(Buffer.from(record.termsHash, 'hex')));
      assert.equal(new PublicKey(d.subarray(56, 88)).toBase58(), payer.publicKey.toBase58());
      assert.equal(new PublicKey(d.subarray(88, 120)).toBase58(), creator.publicKey.toBase58());
      assert.equal(new PublicKey(d.subarray(120, 152)).toBase58(), MINT.toBase58());
      assert.equal(d.readBigUInt64LE(184), 10000n); assert.equal(d.readBigInt64LE(192), BigInt(record.start)); assert.equal(d.readBigInt64LE(200), BigInt(record.end));
      record.fundingVerified = true; save();
      const duplicate = await simulate(fund, [payer, quote]); assert(duplicate.err, 'Duplicate funding unexpectedly accepted'); record.duplicateFundingRejected = true;
      const dispute = await simulate(c.dispute(payer.publicKey, id), [payer]); assert.equal(dispute.err, null, 'Participant dispute simulation failed'); record.disputeSimulationPassed = true;
      const premature = await simulate(c.settlement('resolve', load('booking-devnet-resolver').publicKey, id, MINT, source, destination, 10000n), [payer, load('booking-devnet-resolver')]);
      assert(premature.err, 'Premature settlement unexpectedly accepted'); record.prematureSettlementRejected = true; save();
    }
  } finally {
    const receipt = await connection.getAccountInfo(c.booking(id), 'finalized');
    if (receipt?.owner.equals(c.PROGRAM_ID) && receipt.data[216] === 1) await submit('refund', [refund], [payer]);
  }
  const terminal = await connection.getAccountInfo(c.booking(id), 'finalized');
  assert(terminal?.owner.equals(c.PROGRAM_ID) && terminal.data[216] === 3);
  assert.equal(terminal.data.readBigUInt64LE(218), 0n);
  assert.equal(await balance(), BigInt(record.initialUsdcUnits));
  assert.equal((await connection.getTokenAccountBalance(c.vault(id), 'finalized')).value.amount, '0');
  assert((await simulate(refund, [payer])).err, 'Refund replay unexpectedly accepted');
  assert((await simulate(fund, [payer, quote])).err, 'Settled booking funding replay unexpectedly accepted');
  record.refundReplayRejected = true; record.settledBookingReplayRejected = true;
  record.finalUsdcUnits = (await balance()).toString(); record.finalSolLamports = await connection.getBalance(payer.publicKey, 'finalized');
  record.solSpentLamports = record.initialSolLamports - record.finalSolLamports;
  record.completed = true; record.verifiedAt = new Date().toISOString(); save();
  console.log(JSON.stringify(record));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
