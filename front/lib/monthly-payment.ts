import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { aliasConnection } from './alias-network';
import { DEVNET_USDC_MINT } from './tip-currency';
import { MEMO_PROGRAM, validPaymentSignature } from './sol-payment';
import { verifyUsdcPayment } from './usdc-payment';
import { monthlyMemo } from './monthly-offer';
import { ApiError } from './wallet-session';

export type MonthlyPaymentRecord = { id: string; price_units: number; transaction: string | null; last_valid_block_height: number | null; quoted_slot: number | null };
export async function buildMonthlyPayment(invoice: MonthlyPaymentRecord, payerWallet: string, creatorWallet: string) {
  const connection = await aliasConnection({ commitment: 'finalized' });
  const payer = new PublicKey(payerWallet), recipient = new PublicKey(creatorWallet), mint = new PublicKey(DEVNET_USDC_MINT);
  if (payer.equals(recipient)) throw new ApiError('You cannot buy your own monthly offer.');
  const [latest, quotedSlot] = await Promise.all([connection.getLatestBlockhash('finalized'), connection.getSlot('finalized')]);
  const destination = getAssociatedTokenAddressSync(mint, recipient);
  const transaction = new Transaction({ feePayer: payer, ...latest });
  transaction.add(createAssociatedTokenAccountIdempotentInstruction(payer, destination, recipient, mint));
  transaction.add(createTransferCheckedInstruction(getAssociatedTokenAddressSync(mint, payer), mint, destination, payer, Number(invoice.price_units), 6));
  transaction.add(new TransactionInstruction({ programId: MEMO_PROGRAM, data: Buffer.from(monthlyMemo(invoice.id)), keys: [] }));
  return { transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'), height: latest.lastValidBlockHeight, slot: quotedSlot };
}
export async function verifyMonthlyPayment(invoice: MonthlyPaymentRecord, payer: string, creator: string, signature: string) {
  if (!validPaymentSignature(signature) || !invoice.transaction) throw new ApiError('Provide the signature for this monthly invoice.');
  const connection = await aliasConnection({ commitment: 'finalized' });
  const tx = await connection.getParsedTransaction(signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0 });
  if (!tx?.meta) throw new ApiError('Payment is still finalizing. Retry verification.', 409, 'PAYMENT_PENDING');
  if (tx.meta.err) throw new ApiError('The monthly payment failed. No month was activated.', 400, 'PAYMENT_FAILED');
  const original = Transaction.from(Buffer.from(invoice.transaction, 'base64'));
  const raw = await connection.getTransaction(signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0 });
  if (!raw || !Buffer.from(raw.transaction.message.serialize()).equals(original.serializeMessage())) throw new ApiError('This payment does not match the prepared monthly invoice.', 409, 'PAYMENT_MISMATCH');
  try { verifyUsdcPayment(tx, payer, creator, Number(invoice.price_units), monthlyMemo(invoice.id)); }
  catch { throw new ApiError('This payment does not match the invoice amount, creator, payer, or month.', 409, 'PAYMENT_MISMATCH'); }
}
// Before replacing an expired quote, prove that its exact message did not land.
// Incomplete RPC history keeps the original operation recoverable and never recharges.
export async function recoverExpiredMonthlyPayment(invoice: MonthlyPaymentRecord, payer: string): Promise<{ signature: string | null; height: number }> {
  const connection = await aliasConnection({ commitment: 'finalized' });
  const height = await connection.getBlockHeight('finalized');
  if (!invoice.transaction) return { signature: null, height };
  if (invoice.last_valid_block_height === null || invoice.quoted_slot === null || height <= Number(invoice.last_valid_block_height)) throw new ApiError('The original payment may still land. Wait or verify its signature.', 409, 'PAYMENT_PENDING');
  const original = Transaction.from(Buffer.from(invoice.transaction, 'base64')).serializeMessage();
  let before: string | undefined;
  for (let page = 0; page < 10; page++) {
    const history = await connection.getSignaturesForAddress(new PublicKey(payer), { limit: 100, ...(before ? { before } : {}) }, 'finalized');
    for (const item of history) {
      if (item.slot < Number(invoice.quoted_slot)) return { signature: null, height };
      if (item.err) continue;
      const tx = await connection.getTransaction(item.signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0 });
      if (!tx) throw new ApiError('Payment history is incomplete. Verify the original wallet signature.', 503);
      if (Buffer.from(tx.transaction.message.serialize()).equals(original)) return { signature: item.signature, height };
    }
    if (history.length < 100) return { signature: null, height };
    before = history.at(-1)!.signature;
  }
  throw new ApiError('Payment history is too large to reset safely. Verify the original wallet signature.', 409);
}
