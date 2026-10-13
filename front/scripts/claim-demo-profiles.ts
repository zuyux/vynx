import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import bs58 from 'bs58';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { appDb } from '../lib/app-db';
import { aliasConnection } from '../lib/alias-network';
import { aliasPda, ownerPda, configPda, decodeConfig, readOwnership, registerInstruction, REGISTRY_PROGRAM } from '../lib/alias-registry';

type Receipt = { signature: string; transaction: string; blockhash: string; lastValidBlockHeight: number; intent: string; price: string; version: string; treasury: string };

async function main() {
  const apply = process.argv.includes('--apply');
  const profiles = JSON.parse(readFileSync('data/demo-profiles.json', 'utf8')) as {id:string;alias:string;wallet:string;name:string;bio:string;socials:unknown}[];
  const path = 'data/demo-profile-claims.json';
  const receipts: Record<string, Receipt> = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  const connection = await aliasConnection({ disableRetryOnRateLimit: true });
  const db = appDb();
  const config = decodeConfig(await connection.getAccountInfo(configPda(), 'confirmed'));
  const sponsor = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.VYNX_ALIAS_SPONSOR_SECRET_KEY ?? readFileSync(process.env.VYNX_ALIAS_SPONSOR_KEYPAIR_PATH!, 'utf8'))));
  if (!sponsor.publicKey.equals(config.sponsor) || config.paused) throw Error('Registry sponsor mismatch or registrations paused.');
  for (const profile of profiles) {
    const secret = process.env[`VYNX_${profile.alias.toUpperCase()}_PRIVATE_KEY`];
    if (!secret) throw Error(`Missing demo key: ${profile.alias}`);
    const owner = Keypair.fromSecretKey(bs58.decode(secret));
    if (owner.publicKey.toBase58() !== profile.wallet) throw Error('Demo wallet mismatch.');
    const { data: rows, error } = await db.from('cards_users').select('id,username,wallet_address,design,claim_program,tx_signature').or(`username.eq.${profile.alias},wallet_address.eq.${profile.wallet}`);
    if (error || rows?.length !== 1 || rows[0].id !== profile.id || rows[0].username !== profile.alias || rows[0].wallet_address !== profile.wallet) throw Error(`Conflicting demo profile: ${profile.alias}`);
    const row = rows[0];
    let receipt = receipts[profile.alias];
    const accounts = await connection.getMultipleAccountsInfo([aliasPda(profile.alias), ownerPda(owner.publicKey)], 'confirmed');
    if (!receipt && accounts.some(Boolean)) throw Error(`Existing ownership has no local receipt: ${profile.alias}`);
    if (!receipt && (row.claim_program || row.tx_signature)) throw Error('Existing claim requires manual reconciliation.');
    if (!apply) {
      console.log(JSON.stringify({ alias: profile.alias, wallet: profile.wallet, state: receipt ? 'reconcile' : 'ready', priceLamports: config.tiers[4].toString() }));
      continue;
    }
    if (!receipt) {
      const price = config.tiers[Math.min(profile.alias.length, 5) - 1];
      if (await connection.getBalance(owner.publicKey) < Number(price)) throw Error(`Insufficient demo balance: ${profile.alias}`);
      const latest = await connection.getLatestBlockhash('confirmed');
      const intent = randomBytes(16);
      const tx = new Transaction({ feePayer: sponsor.publicKey, ...latest }).add(registerInstruction(owner.publicKey, config.sponsor, config.treasury, profile.alias, price, config.version, BigInt(await connection.getSlot('confirmed') + 100), intent));
      tx.sign(sponsor, owner);
      receipt = { signature: bs58.encode(tx.signature!), transaction: tx.serialize().toString('base64'), ...latest, intent: intent.toString('hex'), price: price.toString(), version: config.version.toString(), treasury: config.treasury.toBase58() };
      receipts[profile.alias] = receipt;
      writeFileSync(path, JSON.stringify(receipts, null, 2) + '\n');
    }
    const status = (await connection.getSignatureStatuses([receipt.signature], { searchTransactionHistory: true })).value[0];
    if (status?.err) throw Error(`Saved registration failed; inspect receipt: ${profile.alias}`);
    if (!status) {
      if (await connection.getBlockHeight('confirmed') > receipt.lastValidBlockHeight) throw Error(`Saved transaction expired; inspect ownership before retrying: ${profile.alias}`);
      await connection.sendRawTransaction(Buffer.from(receipt.transaction, 'base64'), { skipPreflight: false, maxRetries: 3 });
    }
    if (status?.confirmationStatus !== 'finalized') {
      const confirmation = await connection.confirmTransaction({ signature: receipt.signature, blockhash: receipt.blockhash, lastValidBlockHeight: receipt.lastValidBlockHeight }, 'finalized');
      if (confirmation.value.err) throw Error('Registration failed.');
    }
    const record = await readOwnership(connection, profile.alias, owner.publicKey);
    const tx = await connection.getTransaction(receipt.signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0 });
    const original = Transaction.from(Buffer.from(receipt.transaction, 'base64'));
    if (!tx || !tx.meta || tx.meta.err || !Buffer.from(tx.transaction.message.serialize()).equals(original.serializeMessage()) || record.intent !== receipt.intent || record.price !== BigInt(receipt.price) || record.version !== BigInt(receipt.version) || record.slot !== BigInt(tx.slot)) throw Error('Registration receipt verification failed.');
    const { data: updated, error: updateError } = await db.from('cards_users').update({
      display_name: profile.name, bio: profile.bio, design: { ...row.design, alias: profile.alias, name: profile.name, bio: profile.bio, socials: profile.socials },
      tx_signature: receipt.signature, claim_cluster: 'devnet', claim_lamports: Number(record.price), claim_treasury: new PublicKey(receipt.treasury).toBase58(), claim_verified_at: new Date().toISOString(),
      claim_program: REGISTRY_PROGRAM.toBase58(), claim_alias_pda: aliasPda(profile.alias).toBase58(), claim_owner_pda: ownerPda(owner.publicKey).toBase58(), claim_price_version: receipt.version,
    }).eq('id', profile.id).eq('username', profile.alias).eq('wallet_address', profile.wallet).select('username');
    if (updateError || updated?.length !== 1) throw Error(`Claim confirmed but profile persistence failed: ${profile.alias}`);
    console.log(JSON.stringify({ alias: profile.alias, wallet: profile.wallet, signature: receipt.signature, state: 'claimed' }));
  }
}
main().catch(error => { console.error(error instanceof Error && !/https?:\/\//.test(error.message) ? error.message : 'Demo registration failed; credentials withheld.'); process.exitCode = 1; });
