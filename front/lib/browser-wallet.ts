import { UserFacingError, responseError } from './user-facing-error';

export type BrowserAuthMethod = 'phantom' | 'brave';
export type BrowserSolanaProvider = {
  publicKey: { toBase58: () => string } | null;
  isConnected?: boolean;
  connect: () => Promise<{ publicKey: { toBase58: () => string } }>;
  disconnect: () => Promise<void>;
  signMessage: (message: Uint8Array) => Promise<{ publicKey: { toBase58: () => string }; signature: Uint8Array }>;
  on?: (event: string, listener: () => void) => void;
  removeListener?: (event: string, listener: () => void) => void;
};
type WalletWindow = { phantom?: { solana?: BrowserSolanaProvider }; braveSolana?: BrowserSolanaProvider };

export function browserWallet(method: BrowserAuthMethod, source: WalletWindow = window as WalletWindow) {
  // Brave also reports isPhantom=true. Never use window.solana or that flag to
  // choose a provider: each option must connect the wallet the user selected.
  const provider = method === 'phantom' ? source.phantom?.solana : source.braveSolana;
  if (!provider) throw new UserFacingError(method === 'phantom'
    ? 'Phantom is unavailable. Install or unlock Phantom, or choose another sign-in method.'
    : 'Brave Wallet is unavailable. Set up Brave Wallet in Brave, or choose another sign-in method.');
  return provider;
}
export const browserWalletAddress = (provider: BrowserSolanaProvider) => provider.isConnected === false ? '' : provider.publicKey?.toBase58() ?? '';

export async function authenticateBrowserWallet(provider: BrowserSolanaProvider, signal?: AbortSignal) {
  // Always connect, even when a public key or old application cookie exists.
  const connected = await provider.connect();
  signal?.throwIfAborted();
  const wallet = connected.publicKey.toBase58();
  if (!wallet || browserWalletAddress(provider) !== wallet) throw new UserFacingError('Wallet connection changed. Connect again.');
  const nonceResponse = await fetch('/api/auth/nonce', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet }), signal });
  const nonce = await nonceResponse.json();
  if (!nonceResponse.ok) throw responseError(nonceResponse, nonce, 'Unable to prepare sign-in. Please retry.');
  const signed = await provider.signMessage(new TextEncoder().encode(nonce.message));
  signal?.throwIfAborted();
  if (browserWalletAddress(provider) !== wallet || signed.publicKey.toBase58() !== wallet) throw new UserFacingError('Wallet changed during sign-in. Connect again.');
  const signature = Array.from(signed.signature, byte => byte.toString(16).padStart(2, '0')).join('');
  const response = await fetch('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, id: nonce.id, signature }), signal });
  const session = await response.json();
  if (!response.ok) throw responseError(response, session, 'Unable to sign in. Please retry.');
  if (session.wallet !== wallet || browserWalletAddress(provider) !== wallet) throw new UserFacingError('Wallet changed during sign-in. Connect again.');
  return wallet;
}
