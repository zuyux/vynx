import { CLAIM_PRICE_SOL } from './alias-network';
import { userErrorMessage } from './user-facing-error';

export type ClaimStage = 'sign-in' | 'prepare' | 'send' | 'verify';

export function claimErrorMessage(reason: unknown, stage: ClaimStage, paymentSent: boolean, priceSol: string | number = CLAIM_PRICE_SOL, sponsored = false, fullySponsored = false) {
  const error = reason && typeof reason === 'object' ? reason as { code?: unknown; message?: unknown } : {};
  const code = error.code;
  const message = typeof error.message === 'string' ? error.message : typeof reason === 'string' ? reason : '';
  const guidance: Record<string, string> = {
    WALLET_DEVNET_UNAVAILABLE: 'Connect your wallet on Solana devnet, then try again.',
    PRICE_CHANGED: 'The alias price changed. Refresh the price before approving a payment.',
    QUOTE_EXPIRED: 'Your quote expired. Refresh the price and try again.',
    REGISTRATION_PENDING: 'A registration is still pending. Verify it before making another payment.',
    REGISTRY_MIGRATION_REQUIRED: 'Your existing alias needs an update. Contact support before claiming another alias.',
    SPONSOR_UNAVAILABLE: 'Registration is temporarily unavailable. Please try again shortly.',
  };
  if (typeof code === 'string' && guidance[code]) return paymentSent ? `${guidance[code]} Keep your payment signature; retry verification instead of paying again.` : guidance[code];
  const receipt = 'Keep your payment signature. Retry verification instead of paying again.';
  if (code === 'ALIAS_TAKEN') return paymentSent
    ? 'This alias was claimed before your payment could be registered. Keep your payment signature and contact support before making another payment.'
    : 'This alias is already taken. Choose a different alias and try again.';
  if (code === 'WALLET_HAS_ALIAS') return 'Your wallet already owns an alias. Open your creator card from the dashboard to edit it.';
  if (code === 'INSUFFICIENT_PAYMENT') return `The payment is below the required ${priceSol} devnet SOL. Keep your payment signature and contact support before making another payment.`;
  if (code === 'PAYMENT_FAILED') return sponsored ? 'The registration failed on Solana. VYNX paid the network fee. Refresh the price and retry after the earlier transaction expires.' : 'The transaction failed on Solana. Check your devnet SOL balance, including network fees, then try claiming again.';
  if (code === 'PAYMENT_PENDING') return `Solana has not confirmed the payment yet. ${receipt}`;
  if (code === 'PAYMENT_MISMATCH' || code === 'INVALID_SIGNATURE') return paymentSent
    ? 'The payment could not be verified for this wallet and alias. Keep your payment signature and contact support before making another payment.'
    : 'The payment signature could not be verified. Reconnect the correct wallet and try again.';
  if (paymentSent) return `Your payment was sent, but verification did not finish. ${receipt}`;
  if (code === 'INSUFFICIENT_FUNDS' || /insufficient (funds|balance|lamports)|not enough (sol|funds)|attempt to debit an account but found no record of a prior credit/i.test(message)) {
    if (fullySponsored) return guidance.SPONSOR_UNAVAILABLE;
    return `Add devnet SOL to your connected wallet to cover ${priceSol} SOL${sponsored ? '. VYNX pays network fees' : ' plus network fees'}, then try again.`;
  }
  if (code === 'USER_CANCELLED' || /cancelled|canceled|popup closed|window closed/i.test(message)) return 'Wallet approval was cancelled. Try again when you are ready to approve it in Phantom.';
  // Phantom uses 4001 for user rejection: https://docs.phantom.com/solana/errors
  if (code === 4001 || code === '4001' || code === 'SIGNATURE_REJECTED' || /user rejected|user denied|rejected.*(request|signature|transaction)/i.test(message)) {
    return stage === 'sign-in'
      ? 'Sign-in signature was rejected. Try again and approve the sign-in message in Phantom to continue.'
      : 'Payment signature was rejected. Try again and approve the alias payment in Phantom.';
  }
  if (code === -32003 || code === '-32003') return 'Phantom rejected the transaction. Reconnect your wallet on Solana devnet and try again.';
  if (stage === 'send') return 'Phantom did not return a payment result. Check your wallet activity before trying again; the transaction may have been sent.';
  if (code === 'RPC_TIMEOUT' || /timed? out|timeout/i.test(message)) return 'Solana devnet did not respond in time. Wait a moment, then try again.';
  if (code === 'RPC_UNAVAILABLE') return 'Solana devnet is temporarily unavailable. Wait a moment, then try again.';
  return userErrorMessage(reason, 'Unable to claim your alias. Please try again.');
}
