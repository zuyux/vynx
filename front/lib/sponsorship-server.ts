import { UserFacingError } from './user-facing-error';
import { appDb } from './app-db';
import { createHash, createPublicKey, randomUUID, verify } from 'node:crypto';
import { PublicKey, SystemProgram, Transaction, TransactionInstruction, type ParsedTransactionWithMeta } from '@solana/web3.js';
import type { SponsorAction, SponsorPayload, SponsorRequest } from './sponsorship-domain';

import { aliasConnection } from './alias-network';
export const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const TOKEN = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const MEMO = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export function sponsorDb() {
  return appDb();
}

export function walletKey(value: unknown) {
  if (typeof value !== 'string') throw new UserFacingError("Connect a Solana wallet.");
  try {
    const key = new PublicKey(value);
    if (!PublicKey.isOnCurve(key.toBytes())) throw new Error();
    return key;
  } catch { throw new UserFacingError("Invalid wallet address."); }
}

export function challengeMessage(origin: string, wallet: string, action: SponsorAction, payload: SponsorPayload, id: string, expires: string) {
  const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  // The hash still covers every byte, including images. Keep the wallet prompt small.
  const display = action === 'save-card' ? JSON.stringify({
    alias: (payload.design as Record<string, unknown>).alias,
    offers: (payload.design as Record<string, unknown>).offers,
    published: payload.published,
    operation: 'Save creator offers and page settings',
  }) : action === 'save-design' ? JSON.stringify({
    alias: payload.alias, name: payload.name, bio: payload.bio, accent: payload.accent,
    theme: payload.theme, rounded: payload.rounded, links: payload.links, socials: payload.socials,
    avatar: payload.avatar ? "Image included in the hash" : "No image",
    cover: payload.cover ? "Image included in the hash" : "No image",
    operation: "Publish the design on your Vynx page",
  }) : JSON.stringify(payload);
  return `${origin} requests your authorization for VYNX.
Wallet: ${wallet}
Action: ${action}\nData: ${display}\nHash: ${digest}\nNonce: ${id}
Valid until: ${expires}\nThis signature does not transfer funds.`;
}

export async function issueChallenge(origin: string, wallet: string, action: SponsorAction, payload: SponsorPayload) {
  walletKey(wallet);
  const db = sponsorDb();
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  const { count, error: countError } = await db.from('sponsor_challenges').select('id', { count: 'exact', head: true }).eq('wallet', wallet).gte('created_at', cutoff);
  if (countError) throw new Error('Sponsorship storage is unavailable.');
  if ((count ?? 0) >= 20) throw new UserFacingError("Wait a minute before trying again.");
  const id = randomUUID();
  const expires = new Date(Date.now() + 5 * 60_000).toISOString();
  const message = challengeMessage(origin, wallet, action, payload, id, expires);
  const { error } = await db.from('sponsor_challenges').insert({ id, wallet, message, expires_at: expires });
  if (error) throw new UserFacingError("Could not prepare authorization.");
  return { id, message };
}

export async function authorize(origin: string, body: { wallet: string; action: SponsorAction; payload: SponsorPayload; challenge: string; signature: string }) {
  const key = walletKey(body.wallet);
  const db = sponsorDb();
  const { data, error } = await db.from('sponsor_challenges').select('*').eq('id', body.challenge).eq('wallet', body.wallet).single();
  if (error || !data || Date.parse(data.expires_at) < Date.now()) throw new UserFacingError("The authorization expired. Sign again.");
  if (data.message !== challengeMessage(origin, body.wallet, body.action, body.payload, body.challenge, new Date(data.expires_at).toISOString())) throw new UserFacingError("The request data changed.");
  if (!/^[a-f0-9]{128}$/i.test(body.signature)) throw new UserFacingError("Invalid signature.");
  if (!validWalletSignature(key, data.message, body.signature)) throw new UserFacingError("Could not verify the wallet signature.");
  // Atomic delete ensures concurrent requests cannot reuse the same challenge.
  const { data: consumed, error: consumeError } = await db.from('sponsor_challenges').delete()
    .eq('id', data.id).eq('wallet', body.wallet).gt('expires_at', new Date().toISOString()).select('id');
  if (consumeError || consumed?.length !== 1) throw new UserFacingError("This authorization has already been used.");
  return db;
}

export function validWalletSignature(key: PublicKey, message: string, signature: string) {
  if (!/^[a-f0-9]{128}$/i.test(signature)) return false;
  const publicKey = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), key.toBuffer()]), format: 'der', type: 'spki' });
  return verify(null, Buffer.from(message), publicKey, Buffer.from(signature, 'hex'));
}

export function tokenAccount(wallet: string) {
  return PublicKey.findProgramAddressSync([new PublicKey(wallet).toBuffer(), TOKEN.toBuffer(), USDC_MINT.toBuffer()], ASSOCIATED)[0];
}

export async function checkout(campaign: SponsorRequest) {
  const connection = await aliasConnection();
  const payer = new PublicKey(campaign.brand_wallet);
  const receiver = new PublicKey(campaign.creator_wallet);
  const source = tokenAccount(campaign.brand_wallet);
  const destination = tokenAccount(campaign.creator_wallet);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: payer, blockhash, lastValidBlockHeight });
  // Idempotent associated token account creation, paid by the advertiser.
  tx.add(new TransactionInstruction({ programId: ASSOCIATED, data: Buffer.from([1]), keys: [
    { pubkey: payer, isSigner: true, isWritable: true }, { pubkey: destination, isSigner: false, isWritable: true },
    { pubkey: receiver, isSigner: false, isWritable: false }, { pubkey: USDC_MINT, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, { pubkey: TOKEN, isSigner: false, isWritable: false },
  ] }));
  const data = Buffer.alloc(10);
  data[0] = 12; // SPL Token TransferChecked
  data.writeBigUInt64LE(BigInt(campaign.price_cents) * BigInt(10000), 1);
  data[9] = 6;
  tx.add(new TransactionInstruction({ programId: TOKEN, data, keys: [
    { pubkey: source, isSigner: false, isWritable: true }, { pubkey: USDC_MINT, isSigner: false, isWritable: false },
    { pubkey: destination, isSigner: false, isWritable: true }, { pubkey: payer, isSigner: true, isWritable: false },
  ] }));
  tx.add(new TransactionInstruction({ programId: MEMO, data: Buffer.from(`vynx:sponsor:${campaign.id}`), keys: [] }));
  return { transaction: tx.serialize({ requireAllSignatures: false }).toString('base64'), blockhash, lastValidBlockHeight };
}

export async function verifyPayment(campaign: SponsorRequest, signature: string) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) throw new UserFacingError("Invalid transaction signature.");
  const connection = await aliasConnection({ commitment: 'finalized' });
  const tx = await connection.getParsedTransaction(signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0 });
  if (!tx || !tx.meta) throw new UserFacingError("The payment is not finalized on devnet yet. Wait and verify again.", 'PAYMENT_PENDING');
  if (tx.meta.err) throw new UserFacingError("Transaction failed.", 'PAYMENT_FAILED');
  assertPaymentMatches(campaign, tx);
}

export function assertPaymentMatches(campaign: SponsorRequest, tx: ParsedTransactionWithMeta) {
  if (!tx.meta || tx.meta.err) throw new UserFacingError("Transaction failed.", 'PAYMENT_FAILED');
  const payerSigned = tx.transaction.message.accountKeys.some(k => k.signer && k.pubkey.toBase58() === campaign.brand_wallet);
  const source = tokenAccount(campaign.brand_wallet).toBase58();
  const destination = tokenAccount(campaign.creator_wallet).toBase58();
  const amount = String(campaign.price_cents * 10000);
  const memo = tx.transaction.message.instructions.some(i => i.programId.equals(MEMO) && 'parsed' in i && i.parsed === `vynx:sponsor:${campaign.id}`);
  const transfer = tx.transaction.message.instructions.some(i => {
    if (!i.programId.equals(TOKEN) || !('parsed' in i)) return false;
    const p = i.parsed;
    return p.type === 'transferChecked' && p.info.authority === campaign.brand_wallet &&
      p.info.source === source && p.info.destination === destination && p.info.mint === USDC_MINT.toBase58() &&
      p.info.tokenAmount.amount === amount && p.info.tokenAmount.decimals === 6;
  });
  const index = tx.transaction.message.accountKeys.findIndex(k => k.pubkey.toBase58() === destination);
  const before = tx.meta.preTokenBalances?.find(b => b.accountIndex === index)?.uiTokenAmount.amount ?? '0';
  const after = tx.meta.postTokenBalances?.find(b => b.accountIndex === index && b.mint === USDC_MINT.toBase58() && b.owner === campaign.creator_wallet)?.uiTokenAmount.amount;
  if (!payerSigned || !memo || !transfer || !after || BigInt(after) - BigInt(before) < BigInt(amount)) {
    throw new UserFacingError("The payment does not match this campaign, currency, amount, or recipient.", 'PAYMENT_MISMATCH');
  }
}
