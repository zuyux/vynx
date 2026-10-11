import { UserFacingError } from './user-facing-error';
import { PublicKey, type ParsedTransactionWithMeta } from '@solana/web3.js';

export const MIN_TIP_LAMPORTS = 10_000;
export const MAX_TIP_LAMPORTS = 10_000_000_000;
export const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
export function tipLamports(value: unknown) {
  if (typeof value !== 'string' || !/^\d{1,2}(\.\d{1,9})?$/.test(value)) throw new UserFacingError('Enter a SOL amount with at most 9 decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const amount = Number(BigInt(whole) * BigInt(1_000_000_000) + BigInt(fraction.padEnd(9, '0')));
  if (amount < MIN_TIP_LAMPORTS || amount > MAX_TIP_LAMPORTS) throw new UserFacingError('Tips must be between 0.00001 and 10 SOL.');
  return amount;
}
export function validPaymentSignature(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value);
}
export function verifySolPayment(tx: ParsedTransactionWithMeta | null, payer: string, recipient: string, lamports: number, memo: string) {
  if (!tx || !tx.meta || tx.meta.err) throw new UserFacingError('Payment is not confirmed on Solana devnet. Wait and retry verification.');
  const keys = tx.transaction.message.accountKeys;
  if (payer === recipient || !keys.some(key => key.signer && key.pubkey.toBase58() === payer)) throw new UserFacingError('Payment must be signed by the paying wallet.');
  const transfers = tx.transaction.message.instructions.filter(instruction => 'parsed' in instruction && instruction.program === 'system' && instruction.parsed?.type === 'transfer' && instruction.parsed.info.source === payer && instruction.parsed.info.destination === recipient);
  const exact = transfers.length === 1 && 'parsed' in transfers[0] && transfers[0].parsed.info.lamports === lamports;
  const bound = tx.transaction.message.instructions.some(instruction => instruction.programId?.equals(MEMO_PROGRAM) && 'parsed' in instruction && instruction.parsed === memo);
  const index = keys.findIndex(key => key.pubkey.toBase58() === recipient);
  const received = index >= 0 && tx.meta.postBalances[index] - tx.meta.preBalances[index] >= lamports;
  if (!exact || !bound || !received) throw new UserFacingError('Payment does not match the expected creator, amount and operation.');
}
