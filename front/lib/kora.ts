import { Transaction, PublicKey } from '@solana/web3.js';
import { ApiError } from './wallet-session';

export async function koraRpc<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const endpoint = process.env.KORA_RPC_URL?.trim();
  if (!endpoint) throw new ApiError('Sponsored USDC tips are not available yet. Please try again later or choose SOL.', 503);
  try {
    const response = await fetch(endpoint, {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json', ...(process.env.KORA_API_KEY ? { 'x-api-key': process.env.KORA_API_KEY } : {}) },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const body = await response.json();
    if (!response.ok || body.error || !body.result) throw new Error('Kora request failed.');
    return body.result as T;
  } catch {
    throw new ApiError('Fee sponsorship is temporarily unavailable. Please try again later.', 503);
  }
}

export async function sponsorTipTransaction(transaction: Transaction, wallet: string) {
  const original = transaction.serializeMessage();
  const result = await koraRpc<{ signed_transaction: string; signer_pubkey: string }>('signTransaction', { transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'), signer_key: transaction.feePayer!.toBase58(), sig_verify: false, user_id: wallet });
  const signed = Transaction.from(Buffer.from(result.signed_transaction, 'base64'));
  if (!signed.serializeMessage().equals(original) || !signed.feePayer?.equals(new PublicKey(result.signer_pubkey)) || !signed.signatures.some(item => item.publicKey.equals(signed.feePayer!) && item.signature) || !signed.verifySignatures(false)) {
    throw new ApiError('Fee sponsorship returned an invalid transaction. Please try again later.', 503);
  }
  return result.signed_transaction;
}
