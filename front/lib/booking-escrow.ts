import { createHash } from 'node:crypto';
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, type AccountInfo } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { aliasConnection } from './alias-network';
import { DEVNET_USDC_MINT } from './tip-currency';
import { ApiError } from './wallet-session';

export type CallBooking = {
  id: string; offer_id: string; creator_wallet: string; payer_wallet: string; starts_at: string; ends_at: string;
  expires_at: string; terms: Record<string, unknown>; price_units: number; state: 'awaiting_payment' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'disputed' | 'expired';
  transaction: string | null; last_valid_block_height: number | null; payment_signature: string | null;
};
export const discriminator = (kind: string, name: string) => createHash('sha256').update(`${kind}:${name}`).digest().subarray(0, 8);
export function escrowProgram() {
  // The hackathon explicitly permits this unaudited program on devnet. A hosted
  // demo requires its own opt-in; escrowContext still verifies the devnet genesis.
  if ((process.env.NODE_ENV === 'production' && process.env.VYNX_BOOKING_HACKATHON !== 'true') || process.env.VYNX_BOOKING_ESCROW_ENABLED !== 'true' || !process.env.VYNX_BOOKING_PROGRAM_ID) {
    throw new ApiError("Escrow bookings are not enabled yet.", 503, 'BOOKING_DISABLED');
  }
  return new PublicKey(process.env.VYNX_BOOKING_PROGRAM_ID);
}
export function bookingAddresses(program: PublicKey, id: string) {
  const bytes = Buffer.from(id.replaceAll('-', ''), 'hex');
  const booking = PublicKey.findProgramAddressSync([Buffer.from('booking'), bytes], program)[0];
  return { booking, vault: PublicKey.findProgramAddressSync([Buffer.from('vault'), booking.toBuffer()], program)[0], config: PublicKey.findProgramAddressSync([Buffer.from('config')], program)[0] };
}
export const termsHash = (b: CallBooking) => createHash('sha256').update(JSON.stringify({ id: b.id, offer: b.offer_id, payer: b.payer_wallet, creator: b.creator_wallet, starts: b.starts_at, ends: b.ends_at, price: String(b.price_units), terms: b.terms })).digest();
export function assertEscrowReceipt(info: AccountInfo<Buffer>, program: PublicKey, b: CallBooking, resolver?: PublicKey) {
  const d = info.data;
  if (!info.owner.equals(program) || d.length !== 226 || !d.subarray(0, 8).equals(discriminator('account', 'Booking'))
    || !d.subarray(8, 24).equals(Buffer.from(b.id.replaceAll('-', ''), 'hex')) || !d.subarray(24, 56).equals(termsHash(b))
    || new PublicKey(d.subarray(56, 88)).toBase58() !== b.payer_wallet || new PublicKey(d.subarray(88, 120)).toBase58() !== b.creator_wallet
    || new PublicKey(d.subarray(120, 152)).toBase58() !== DEVNET_USDC_MINT || (resolver && !new PublicKey(d.subarray(152, 184)).equals(resolver))
    || d.readBigUInt64LE(184) !== BigInt(b.price_units) || d.readBigInt64LE(192) !== BigInt(Date.parse(b.starts_at) / 1000)
    || d.readBigInt64LE(200) !== BigInt(Date.parse(b.ends_at) / 1000) || d.readBigInt64LE(208) > BigInt(Date.parse(b.expires_at) / 1000)
    || ![1, 2, 3].includes(d[216])) throw new ApiError("The escrow receipt does not match this booking.", 409, 'PAYMENT_MISMATCH');
}
export async function escrowContext() {
  const program = escrowProgram();
  const connection = await aliasConnection({ commitment: 'finalized' });
  const config = bookingAddresses(program, '00000000-0000-0000-0000-000000000000').config;
  const [info, executable] = await Promise.all([connection.getAccountInfo(config, 'finalized'), connection.getAccountInfo(program, 'finalized')]);
  if (!executable?.executable || !info?.owner.equals(program) || info.data.length !== 105 || !info.data.subarray(0, 8).equals(discriminator('account', 'Config'))
    || new PublicKey(info.data.subarray(72, 104)).toBase58() !== DEVNET_USDC_MINT) throw new ApiError("Escrow is not configured for devnet USDC.", 503);
  return { program, connection, quoteAuthority: new PublicKey(info.data.subarray(8, 40)), resolver: new PublicKey(info.data.subarray(40, 72)) };
}
export async function buildBookingPayment(b: CallBooking) {
  const { program, connection, quoteAuthority } = await escrowContext();
  const raw = process.env.VYNX_BOOKING_QUOTE_SECRET;
  if (!raw) throw new ApiError("The server booking authority is missing.", 503);
  const signer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  if (!signer.publicKey.equals(quoteAuthority)) throw new ApiError("The booking authority does not match the escrow.", 503);
  const { booking, vault, config } = bookingAddresses(program, b.id);
  const payer = new PublicKey(b.payer_wallet), mint = new PublicKey(DEVNET_USDC_MINT);
  const data = Buffer.alloc(88);
  discriminator('global', 'fund').copy(data); Buffer.from(b.id.replaceAll('-', ''), 'hex').copy(data, 8); termsHash(b).copy(data, 24);
  data.writeBigUInt64LE(BigInt(b.price_units), 56); data.writeBigInt64LE(BigInt(Date.parse(b.starts_at) / 1000), 64);
  data.writeBigInt64LE(BigInt(Date.parse(b.ends_at) / 1000), 72); data.writeBigInt64LE(BigInt(Date.parse(b.expires_at) / 1000), 80);
  const latest = await connection.getLatestBlockhash('finalized');
  // Fund only the exact rent consumed by the program's two init accounts.
  // The transfer and escrow funding are atomic, so a rejected booking cannot
  // leave sponsored SOL in the customer's wallet. The quote authority already
  // co-signs every booking and now also pays the network fee.
  const rents = await Promise.all([connection.getMinimumBalanceForRentExemption(226), connection.getMinimumBalanceForRentExemption(165)]);
  const rent = rents[0] + rents[1];
  if (!Number.isSafeInteger(rent) || rent <= 0 || rent > 10_000_000 || payer.equals(signer.publicKey)) {
    throw new ApiError('Booking sponsorship is unavailable.', 503, 'SPONSOR_UNAVAILABLE');
  }
  const tx = new Transaction({ feePayer: signer.publicKey, ...latest })
    .add(SystemProgram.transfer({ fromPubkey: signer.publicKey, toPubkey: payer, lamports: rent }))
    .add(new TransactionInstruction({ programId: program, data, keys: [
    { pubkey: payer, isSigner: true, isWritable: true }, { pubkey: signer.publicKey, isSigner: true, isWritable: false },
    { pubkey: config, isSigner: false, isWritable: false }, { pubkey: new PublicKey(b.creator_wallet), isSigner: false, isWritable: false },
    { pubkey: booking, isSigner: false, isWritable: true }, { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: getAssociatedTokenAddressSync(mint, payer), isSigner: false, isWritable: true }, { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ] }));
  const fee = (await connection.getFeeForMessage(tx.compileMessage(), 'finalized')).value;
  if (!fee || fee > 50_000 || await connection.getBalance(signer.publicKey, 'finalized') < rent + fee) {
    throw new ApiError('Booking sponsorship is temporarily unavailable. Please try again later.', 503, 'SPONSOR_UNAVAILABLE');
  }
  tx.partialSign(signer);
  return { transaction: tx.serialize({ requireAllSignatures: false }).toString('base64'), height: latest.lastValidBlockHeight };
}
export async function verifyBookingPayment(b: CallBooking, signature: string) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature) || !b.transaction) throw new ApiError("Invalid payment signature.");
  const { program, connection, resolver } = await escrowContext();
  const [tx, receipt] = await Promise.all([
    connection.getTransaction(signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0 }),
    connection.getAccountInfo(bookingAddresses(program, b.id).booking, 'finalized'),
  ]);
  if (!tx?.meta) throw new ApiError("The payment is not finalized yet. Retry verification.", 409, 'PAYMENT_PENDING');
  if (tx.meta.err) throw new ApiError("The payment failed on devnet.", 400, 'PAYMENT_FAILED');
  const original = Transaction.from(Buffer.from(b.transaction, 'base64'));
  if (!Buffer.from(tx.transaction.message.serialize()).equals(original.serializeMessage()) || !receipt) throw new ApiError("The transaction does not match this booking.", 409, 'PAYMENT_MISMATCH');
  assertEscrowReceipt(receipt, program, b, resolver);
}
