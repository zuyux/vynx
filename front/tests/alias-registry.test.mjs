import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { aliasPda, ownerPda, configPda, REGISTRY_PROGRAM, discriminator, decodeConfig, registerInstruction, verifyOwnershipAccounts, solPrice } from '../lib/alias-registry.ts';
import { normalizeAlias } from '../lib/alias.ts';
const info = data => ({ data, owner: REGISTRY_PROGRAM, executable: false, lamports: 2000000, rentEpoch: 0 });
function ownership(alias, owner) {
  const record = Buffer.alloc(115); discriminator('account', 'AliasRecord').copy(record); owner.toBuffer().copy(record, 8); record.writeUInt32LE(alias.length, 40); record.write(alias, 44); record.writeBigUInt64LE(10000000n, 52 + alias.length); record.writeBigUInt64LE(1n, 60 + alias.length); record[84 + alias.length] = PublicKey.findProgramAddressSync([Buffer.from('alias'), Buffer.from(alias)], REGISTRY_PROGRAM)[1];
  const index = Buffer.alloc(73); discriminator('account', 'OwnerIndex').copy(index); owner.toBuffer().copy(index, 8); aliasPda(alias).toBuffer().copy(index, 40); index[72] = PublicKey.findProgramAddressSync([Buffer.from('owner'), owner.toBuffer()], REGISTRY_PROGRAM)[1];
  return [info(record), info(index)];
}
test('ownership requires both program-owned PDAs, matching alias, owner, index and bumps', () => {
  const owner = Keypair.generate().publicKey;
  for (const alias of ['z', 'zx', 'x'.repeat(30)]) {
    const [record, index] = ownership(alias, owner); assert.equal(verifyOwnershipAccounts(alias, owner, record, index).alias, alias);
    assert.throws(() => verifyOwnershipAccounts(alias, owner, record, null));
    assert.throws(() => verifyOwnershipAccounts(alias, owner, { ...record, owner: SystemProgram.programId }, index));
    assert.throws(() => verifyOwnershipAccounts(alias, owner, record, { ...index, executable: true }));
    assert.throws(() => verifyOwnershipAccounts(alias, Keypair.generate().publicKey, record, index));
    const altered = Buffer.from(index.data); Keypair.generate().publicKey.toBuffer().copy(altered, 40); assert.throws(() => verifyOwnershipAccounts(alias, owner, record, info(altered)));
    const badBump = Buffer.from(record.data); badBump[84 + alias.length] ^= 1; assert.throws(() => verifyOwnershipAccounts(alias, owner, info(badBump), index));
    assert.throws(() => verifyOwnershipAccounts('other', owner, record, index));
  }
});
test('registration instruction binds both PDAs, all signers and exact pricing, expiry and intent', () => {
  const owner = Keypair.generate().publicKey, sponsor = Keypair.generate().publicKey, treasury = Keypair.generate().publicKey;
  const intent = Buffer.alloc(16, 7);
  const ix = registerInstruction(owner, sponsor, treasury, 'a', 920000000n, 4n, 99n, intent);
  assert(ix.programId.equals(REGISTRY_PROGRAM)); assert(ix.keys[0].isSigner); assert(ix.keys[1].isSigner); assert(ix.keys[4].pubkey.equals(aliasPda('a'))); assert(ix.keys[5].pubkey.equals(ownerPda(owner))); assert(ix.keys[2].pubkey.equals(configPda()));
  assert.equal(ix.data.readBigUInt64LE(13), 920000000n); assert.equal(ix.data.readBigUInt64LE(21), 4n); assert.equal(ix.data.readBigUInt64LE(29), 99n); assert(ix.data.subarray(37).equals(intent));
  assert.throws(() => registerInstruction(owner, sponsor, treasury, 'A', 1n, 1n, 1n, intent));
});
test('config prices retain exact lamports and validate discriminator, owner, size, ordering and bump', () => {
  const d = Buffer.alloc(186); discriminator('account', 'Config').copy(d); Keypair.generate().publicKey.toBuffer().copy(d, 72); Keypair.generate().publicKey.toBuffer().copy(d, 104);
  [920000000n, 530000000n, 300000000n, 140000000n, 10000000n].forEach((n,i) => d.writeBigUInt64LE(n, 136 + i*8)); d.writeBigUInt64LE(2n,176); d[185] = PublicKey.findProgramAddressSync([Buffer.from('config')],REGISTRY_PROGRAM)[1];
  assert.equal(decodeConfig(info(d)).version, 2n); assert.equal(solPrice(decodeConfig(info(d)).tiers[0]), '0.92'); assert.equal(solPrice(10000000n), '0.01'); assert.equal(solPrice(100000000000n), '100'); assert.equal(solPrice(1n), '0.000000001');
  d.writeBigUInt64LE(1n,136); assert.throws(() => decodeConfig(info(d))); assert.throws(() => decodeConfig(info(Buffer.alloc(185))));
});
test('client and program naming limits and reserved operational aliases agree', () => {
  for (const alias of ['help','docs','brand','security','treasury','official','vynx','system','admin']) assert.throws(() => normalizeAlias(alias));
  assert.equal(normalizeAlias('@Z'), 'z'); assert.equal(normalizeAlias('a'.repeat(30)), 'a'.repeat(30)); assert.throws(() => normalizeAlias('a'.repeat(31)));
});
