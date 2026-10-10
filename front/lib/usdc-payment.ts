import { PublicKey, type ParsedTransactionWithMeta } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { MEMO_PROGRAM } from './sol-payment';
import { DEVNET_USDC_MINT } from './tip-currency';

export function verifyUsdcPayment(tx: ParsedTransactionWithMeta | null, payer: string, recipient: string, units: number, memo: string) {
  if (!tx?.meta || tx.meta.err) throw new Error('Payment is not confirmed on Solana devnet. Wait and retry verification.');
  const keys = tx.transaction.message.accountKeys;
  if (payer === recipient || !keys.some(key => key.signer && key.pubkey.toBase58() === payer)) throw new Error('Payment must be signed by the paying wallet.');
  const mint = new PublicKey(DEVNET_USDC_MINT);
  const source = getAssociatedTokenAddressSync(mint, new PublicKey(payer)).toBase58();
  const destination = getAssociatedTokenAddressSync(mint, new PublicKey(recipient)).toBase58();
  const transfers = tx.transaction.message.instructions.filter(instruction => 'parsed' in instruction && instruction.programId.equals(TOKEN_PROGRAM_ID) && instruction.parsed?.type === 'transferChecked' && instruction.parsed.info.source === source && instruction.parsed.info.destination === destination);
  const exact = transfers.length === 1 && 'parsed' in transfers[0] && transfers[0].parsed.info.authority === payer && transfers[0].parsed.info.mint === DEVNET_USDC_MINT && transfers[0].parsed.info.tokenAmount.amount === String(units) && transfers[0].parsed.info.tokenAmount.decimals === 6;
  const bound = tx.transaction.message.instructions.some(instruction => instruction.programId.equals(MEMO_PROGRAM) && 'parsed' in instruction && instruction.parsed === memo);
  const index = keys.findIndex(key => key.pubkey.toBase58() === destination);
  const pre = tx.meta.preTokenBalances?.find(balance => balance.accountIndex === index);
  const post = tx.meta.postTokenBalances?.find(balance => balance.accountIndex === index);
  const received = post?.mint === DEVNET_USDC_MINT && post.owner === recipient && post.uiTokenAmount.decimals === 6 && (!pre || (pre.mint === DEVNET_USDC_MINT && pre.owner === recipient && pre.uiTokenAmount.decimals === 6)) && BigInt(post.uiTokenAmount.amount) - BigInt(pre?.uiTokenAmount.amount ?? '0') >= BigInt(units);
  if (!exact || !bound || !received) throw new Error('Payment does not match the expected USDC mint, creator, amount and operation.');
}
