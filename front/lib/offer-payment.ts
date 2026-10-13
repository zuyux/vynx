import { matchesPreparedPayment } from './prepared-payment';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { aliasConnection } from './alias-network';
import { DEVNET_USDC_MINT } from './tip-currency';
import { MEMO_PROGRAM, validPaymentSignature } from './sol-payment';
import { verifyUsdcPayment } from './usdc-payment';
import { offerPurchaseMemo } from './offer-purchase';
import { ApiError } from './wallet-session';
import type { MonthlyPaymentRecord } from './monthly-payment';

export async function buildOfferPayment(purchase: MonthlyPaymentRecord, payerWallet: string, creatorWallet: string) {
  const connection = await aliasConnection({ commitment: 'finalized' });
  const payer = new PublicKey(payerWallet), recipient = new PublicKey(creatorWallet), mint = new PublicKey(DEVNET_USDC_MINT);
  if (payer.equals(recipient)) throw new ApiError('You cannot buy your own offer.');
  const [latest, slot] = await Promise.all([connection.getLatestBlockhash('finalized'), connection.getSlot('finalized')]);
  const destination = getAssociatedTokenAddressSync(mint, recipient);
  const transaction = new Transaction({ feePayer: payer, ...latest });
  transaction.add(createAssociatedTokenAccountIdempotentInstruction(payer, destination, recipient, mint));
  transaction.add(createTransferCheckedInstruction(getAssociatedTokenAddressSync(mint, payer), mint, destination, payer, Number(purchase.price_units), 6));
  transaction.add(new TransactionInstruction({ programId: MEMO_PROGRAM, data: Buffer.from(offerPurchaseMemo(purchase.id)), keys: [] }));
  return { transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'), height: latest.lastValidBlockHeight, slot };
}
export async function verifyOfferPayment(purchase: MonthlyPaymentRecord, payer: string, creator: string, signature: string) {
  if (!validPaymentSignature(signature) || !purchase.transaction) throw new ApiError('Provide the signature for this offer payment.');
  const connection = await aliasConnection({ commitment: 'finalized' });
  const tx = await connection.getParsedTransaction(signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0 });
  if (!tx?.meta) throw new ApiError('Payment is still finalizing. Retry verification.', 409, 'PAYMENT_PENDING');
  if (tx.meta.err) throw new ApiError('Payment failed. No purchase was recorded.', 400, 'PAYMENT_FAILED');
  const original = Transaction.from(Buffer.from(purchase.transaction, 'base64'));
  const raw = await connection.getTransaction(signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0 });
  if (!raw || !matchesPreparedPayment(original, raw)) throw new ApiError('This transfer does not match the prepared offer payment.', 409, 'PAYMENT_MISMATCH');
  try { verifyUsdcPayment(tx, payer, creator, Number(purchase.price_units), offerPurchaseMemo(purchase.id)); }
  catch { throw new ApiError('This transfer does not match the offer, price, creator, or paying wallet.', 409, 'PAYMENT_MISMATCH'); }
}
