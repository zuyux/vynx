import { assertRegistryOwnership } from './alias-registration';
import { Transaction, TransactionInstruction } from '@solana/web3.js';
import { appDb } from '@/lib/app-db';
import { publicCreator } from '@/lib/public-creator';
import { aliasConnection } from '@/lib/alias-network';
import { tipLamports, MEMO_PROGRAM, validPaymentSignature, verifySolPayment } from '@/lib/sol-payment';
import { walletKey } from '@/lib/sponsorship-server';
import { ApiError } from '@/lib/wallet-session';
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { DEVNET_USDC_MINT, tipCurrency, tipUsdcUnits } from './tip-currency';
import { verifyUsdcPayment } from './usdc-payment';
import { koraRpc, sponsorTipTransaction } from './kora';

export async function buildTip(alias: string, wallet: string, amount: string, currencyValue?: unknown) {
  if (currencyValue !== undefined && currencyValue !== 'USDC') throw new ApiError('Tips are only accepted in USDC.');
  const currency = 'USDC';
  const creator = await publicCreator(alias);
  if (!creator || !creator.tipsEnabled) throw new ApiError('This creator is not receiving tips.', 404);
  const payer = walletKey(wallet);
  const recipient = walletKey(creator.wallet);
  if (payer.equals(recipient)) throw new ApiError('Use a different wallet to tip this creator.');
  const units = tipUsdcUnits(amount);
  const connection = await aliasConnection();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const { signer_address } = await koraRpc<{ signer_address: string }>('getPayerSigner');
  const feePayer = walletKey(signer_address);
  if (feePayer.equals(payer) || feePayer.equals(recipient)) throw new ApiError('The sponsor must use a separate wallet.', 503);
  const transaction = new Transaction({ feePayer, blockhash, lastValidBlockHeight });
  const mint = new PublicKey(DEVNET_USDC_MINT);
  const source = getAssociatedTokenAddressSync(mint, payer);
  const destination = getAssociatedTokenAddressSync(mint, recipient);
  transaction.add(createAssociatedTokenAccountIdempotentInstruction(feePayer, destination, recipient, mint));
  transaction.add(createTransferCheckedInstruction(source, mint, destination, payer, units, 6));
  transaction.add(new TransactionInstruction({ programId: MEMO_PROGRAM, data: Buffer.from(`vynx:tip:${creator.id}`), keys: [] }));
  const serialized = await sponsorTipTransaction(transaction, wallet);
  return { transaction: serialized, blockhash, lastValidBlockHeight, currency, units, lamports: null, recipient: creator.wallet, sponsored: true };
}
export async function confirmTip(alias: string, wallet: string, amount: string, signature: string, currencyValue?: unknown) {
  const currency = tipCurrency(currencyValue);
  if (!validPaymentSignature(signature)) throw new ApiError('Invalid payment signature.');
  const units = currency === 'USDC' ? tipUsdcUnits(amount) : tipLamports(amount);
  const db = appDb();
  const { data: creator, error: creatorError } = await db.from('cards_users').select('id,wallet_address').eq('username', alias).maybeSingle();
  if (creatorError) throw new ApiError('Creator storage is unavailable.', 503);
  if (!creator) throw new ApiError('Creator not found.', 404);
  await assertRegistryOwnership(creator.wallet_address, alias);
  const existing = async () => {
    const { data, error } = await db.from('tips').select('creator_id,payer,lamports,currency,token_amount,signature').eq('signature', signature).maybeSingle();
    if (error) throw new ApiError('Tip verification is temporarily unavailable. Please try again.', 503);
    if (!data) return false;
    if (data.creator_id !== creator.id || data.payer !== wallet || data.currency !== currency || Number(currency === 'USDC' ? data.token_amount : data.lamports) !== units) throw new ApiError('This signature already belongs to another payment.', 409);
    return true;
  };
  if (await existing()) return { ok: true, signature };
  const connection = await aliasConnection();
  const tx = await connection.getParsedTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
  if (!tx) throw new ApiError('Payment is still confirming on Solana. Please retry verification if needed.', 409, 'PAYMENT_PENDING');
  if (tx.meta?.err) throw new ApiError('The devnet transaction failed. No payment was recorded.', 400, 'PAYMENT_FAILED');
  if (currency === 'USDC') verifyUsdcPayment(tx, wallet, creator.wallet_address, units, `vynx:tip:${creator.id}`);
  else verifySolPayment(tx, wallet, creator.wallet_address, units, `vynx:tip:${creator.id}`);
  const { error } = await db.from('tips').insert({ creator_id: creator.id, payer: wallet, recipient: creator.wallet_address, currency, lamports: currency === 'SOL' ? units : null, token_amount: currency === 'USDC' ? units : null, token_mint: currency === 'USDC' ? DEVNET_USDC_MINT : null, signature });
  if (error) {
    if (error.code === '23505' && await existing()) return { ok: true, signature };
    throw new ApiError('Unable to record your tip. Keep the signature and retry verification without paying again.', 503);
  }
  return { ok: true, signature };
}
