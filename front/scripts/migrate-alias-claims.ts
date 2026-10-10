import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { appDb } from '../lib/app-db';
import { aliasConnection } from '../lib/alias-network';
import { normalizeAlias } from '../lib/alias';
import { verifySolPayment, validPaymentSignature } from '../lib/sol-payment';
import { aliasPda, ownerPda, configPda, decodeConfig, discriminator, readOwnership, REGISTRY_PROGRAM } from '../lib/alias-registry';

// No automatic submission: the creator must sign the prepared transaction.
async function main() {
  const [mode = 'audit', alias, output] = process.argv.slice(2);
  if (!['audit', 'prepare', 'reconcile'].includes(mode) || (mode !== 'audit' && !alias)) throw Error('Usage: audit | prepare ALIAS OUTPUT | reconcile ALIAS');
  if (mode === 'prepare' && !output) throw Error('Provide an output file for the owner-signing transaction.');
  const connection = await aliasConnection();
  const db = appDb();
  let query = db.from('cards_users').select('username,wallet_address,tx_signature,claim_cluster,claim_lamports,claim_treasury,claim_verified_at,claim_program');
  if (alias) query = query.eq('username', normalizeAlias(alias));
  const { data: rows, error } = await query.order('username');
  if (error) throw Error('Unable to read legacy claims. Apply migrations 001–006.');
  if (alias && rows?.length !== 1) throw Error('Expected exactly one existing claim.');
  for (const row of rows ?? []) {
    try {
      const name = normalizeAlias(row.username);
      if (name !== row.username) throw Error('Noncanonical alias requires manual review.');
      const owner = new PublicKey(row.wallet_address);
      if (row.claim_program && row.claim_program !== REGISTRY_PROGRAM.toBase58()) throw Error('Unexpected claim program.');
      if (row.claim_program) {
        await readOwnership(connection, name, owner);
        console.log(JSON.stringify({ alias: name, state: 'registry' }));
        continue;
      }
      if (row.claim_cluster !== 'devnet' || !row.claim_verified_at || !validPaymentSignature(row.tx_signature) || !Number.isSafeInteger(row.claim_lamports) || row.claim_lamports <= 0) throw Error('Missing verified legacy payment evidence.');
      const treasury = new PublicKey(row.claim_treasury).toBase58();
      // Never use today's price/treasury to validate a historical purchase.
      const tx = await connection.getParsedTransaction(row.tx_signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0 });
      verifySolPayment(tx, owner.toBase58(), treasury, row.claim_lamports, `vynx:claim:${name}`);
      const claimId = createHash('sha256').update(`vynx:legacy:${row.tx_signature}:${name}:${owner.toBase58()}`).digest().subarray(0, 16);
      const accounts = await connection.getMultipleAccountsInfo([aliasPda(name), ownerPda(owner)], 'confirmed');
      if (accounts.some(info => info && (!info.owner.equals(SystemProgram.programId) || info.data.length || info.executable))) {
        const record = await readOwnership(connection, name, owner);
        if (record.price !== BigInt(0) || record.version !== BigInt(0) || record.intent !== claimId.toString('hex')) throw Error('Registry record is not this legacy migration.');
        if (mode === 'reconcile') {
          const { data, error: updateError } = await db.from('cards_users').update({ claim_program: REGISTRY_PROGRAM.toBase58(), claim_alias_pda: aliasPda(name).toBase58(), claim_owner_pda: ownerPda(owner).toBase58(), claim_price_version: 0 })
            .eq('username', name).eq('wallet_address', row.wallet_address).eq('tx_signature', row.tx_signature).is('claim_program', null).select('username');
          if (updateError || data?.length !== 1) throw Error('Claim changed during reconciliation; rerun audit.');
        }
        console.log(JSON.stringify({ alias: name, state: mode === 'reconcile' ? 'reconciled' : 'awaiting-reconciliation' }));
        continue;
      }
      if (mode === 'reconcile') throw Error('Migration has not confirmed on chain.');
      if (mode === 'prepare') {
        const configInfo = await connection.getAccountInfo(configPda(), 'confirmed');
        const config = decodeConfig(configInfo);
        if (!config.paused) throw Error('Pause new registrations for the migration maintenance window.');
        const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.env.VYNX_MIGRATION_ADMIN_KEYPAIR_PATH!, 'utf8'))));
        if (!configInfo!.data.subarray(8, 40).equals(admin.publicKey.toBuffer())) throw Error('Keypair is not the configured registry admin.');
        if (owner.equals(admin.publicKey)) throw Error('Owner must differ from the migration fee payer.');
        const expiry = BigInt(await connection.getSlot('confirmed')) + BigInt(120);
        const nameBytes = Buffer.from(name);
        const payload = Buffer.alloc(12 + nameBytes.length + 8 + 16);
        discriminator('global', 'migrate_verified_claim').copy(payload);
        payload.writeUInt32LE(nameBytes.length, 8); nameBytes.copy(payload, 12);
        payload.writeBigUInt64LE(expiry, 12 + nameBytes.length); claimId.copy(payload, 20 + nameBytes.length);
        const keys = [[admin.publicKey, true, true], [owner, true, false], [configPda(), false, false], [aliasPda(name), false, true], [ownerPda(owner), false, true], [SystemProgram.programId, false, false]] as const;
        const latest = await connection.getLatestBlockhash('confirmed');
        const transaction = new Transaction({ feePayer: admin.publicKey, ...latest }).add(new TransactionInstruction({ programId: REGISTRY_PROGRAM, data: payload, keys: keys.map(([pubkey, isSigner, isWritable]) => ({ pubkey, isSigner, isWritable })) }));
        transaction.partialSign(admin);
        writeFileSync(output, JSON.stringify({ alias: name, owner: owner.toBase58(), cluster: 'devnet', expiresAtSlot: expiry.toString(), ...latest, transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64') }, null, 2), { flag: 'wx', mode: 0o600 });
      }
      console.log(JSON.stringify({ alias: name, state: mode === 'prepare' ? 'prepared' : 'eligible' }));
    } catch (reason) {
      console.log(JSON.stringify({ alias: row.username, state: 'blocked', reason: reason instanceof Error ? reason.message : 'Unknown failure' }));
      process.exitCode = 1;
    }
  }
}
main().catch(() => { console.error('Migration command failed. Check mode, configuration and devnet RPC availability.'); process.exitCode = 1; });
