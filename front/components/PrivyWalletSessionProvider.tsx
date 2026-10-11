'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLogin, usePrivy } from '@privy-io/react-auth';
import { useSignAndSendTransaction, useSignMessage, useWallets } from '@privy-io/react-auth/solana';
import bs58 from 'bs58';
import { WalletSessionContext, type PrivySignInOptions } from './WalletSessionProvider';
import { UserFacingError, responseError } from '@/lib/user-facing-error';
import { aliasConnection } from '@/lib/alias-network';

export function PrivyWalletSessionProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, getAccessToken, logout: privyLogout, connectWallet } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { signMessage } = useSignMessage();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  // Prefer the wallet used to log in. Email/social users receive an embedded wallet.
  const selected = wallets.find(wallet => wallet.address === user?.wallet?.address) ?? wallets[0];
  const connectedWallet = authenticated ? selected?.address ?? '' : '';
  const [wallet, setWallet] = useState('');
  const [checking, setChecking] = useState(false);
  const [active, setActive] = useState(false);
  const sessionEnabled = useRef(false);
  const pending = useRef<{ promise: Promise<string>; resolve: (wallet: string) => void; reject: (reason: unknown) => void } | null>(null);
  const exchanging = useRef<Promise<string> | null>(null);
  const authorizedAddress = useRef('');
  const currentAddress = useRef(connectedWallet);
  useEffect(() => { currentAddress.current = connectedWallet; }, [connectedWallet]);
  const { login } = useLogin({ onComplete: () => { sessionEnabled.current = true; setActive(true); }, onError: () => {
    sessionEnabled.current = false; setActive(false);
    pending.current?.reject(new UserFacingError('Sign-in was cancelled or could not complete. Try again.'));
    pending.current = null;
  } });

  const ensureSession = useCallback(async () => {
    if (!sessionEnabled.current || !authenticated || !connectedWallet) throw new UserFacingError('Sign in and select a Solana wallet first.');
    if (exchanging.current) return exchanging.current;
    const attempt = (async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new UserFacingError('Sign in again to continue.');
      const response = await fetch('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'privy', accessToken, wallet: connectedWallet }) });
      const result = await response.json();
      if (!response.ok) throw responseError(response, result, 'Unable to sign in. Please retry.');
      if (!sessionEnabled.current || currentAddress.current !== connectedWallet) throw new UserFacingError('Wallet changed. Sign in with the selected wallet.');
      authorizedAddress.current = result.wallet;
      setWallet(result.wallet);
      return result.wallet as string;
    })();
    exchanging.current = attempt;
    try { return await attempt; } finally { exchanging.current = null; }
  }, [authenticated, connectedWallet, getAccessToken]);

  useEffect(() => {
    if (!ready || !walletsReady) return;
    if (!active || !authenticated || !connectedWallet) return;
    let mounted = true;
    void ensureSession().then(address => {
      if (mounted) { pending.current?.resolve(address); pending.current = null; }
    }).catch(reason => {
      if (mounted) { pending.current?.reject(reason); pending.current = null; }
    }).finally(() => { if (mounted) setChecking(false); });
    // Keep the cookie valid while the user remains signed into Privy.
    const timer = setInterval(() => { void ensureSession().catch(() => setWallet('')); }, 45 * 60_000);
    return () => { mounted = false; clearInterval(timer); };
  }, [ready, walletsReady, authenticated, connectedWallet, ensureSession, active]);
  useEffect(() => () => { pending.current?.reject(new UserFacingError('Sign-in interrupted.')); pending.current = null; }, []);

  async function authenticate(options?: PrivySignInOptions) {
    if (!ready) return Promise.reject(new UserFacingError('Sign-in is loading. Please try again.'));
    if (pending.current) return pending.current.promise;
    if (options && authenticated) await logout();
    if (!options && authenticated && connectedWallet && selected) {
      return (async () => {
        // Privy's saved external account is not proof of a live connection.
        if (selected.standardWallet.name !== 'Privy') {
          const connection = selected.standardWallet.features['standard:connect'];
          if (!connection) throw new UserFacingError('Reconnect your external wallet or select Phantom or Brave Wallet.');
          const result = await connection.connect();
          if (!result.accounts.some(account => account.address === connectedWallet)) throw new UserFacingError('Wallet changed. Sign in with the selected account again.');
        }
        sessionEnabled.current = true; setActive(true);
        return ensureSession();
      })();
    }
    let resolve!: (wallet: string) => void, reject!: (reason: unknown) => void;
    const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
    pending.current = { promise, resolve, reject };
    try {
      login(options ? { loginMethods: [options.method], ...(options.method === 'email' && options.email ? { prefill: { type: 'email', value: options.email } } : {}) } : undefined);
    } catch (reason) { pending.current?.reject(reason); pending.current = null; }
    return promise;
  }
  async function deactivate() {
    sessionEnabled.current = false; setActive(false);
    pending.current?.reject(new UserFacingError('Sign-in method changed.')); pending.current = null;
    if (exchanging.current) await exchanging.current.catch(() => {});
    authorizedAddress.current = ''; setWallet('');
  }
  async function logout() {
    sessionEnabled.current = false; setActive(false);
    pending.current?.reject(new UserFacingError('Signed out.')); pending.current = null;
    if (exchanging.current) await exchanging.current.catch(() => {});
    const response = await fetch('/api/auth/session', { method: 'DELETE' });
    if (!response.ok) throw responseError(response, await response.json(), 'Unable to sign out. Try again.');
    authorizedAddress.current = '';
    setWallet('');
    await privyLogout();
  }
  const sessionWallet = authenticated && connectedWallet === wallet ? wallet : '';
  return <WalletSessionContext.Provider value={{ wallet: sessionWallet, connectedWallet, checking: !ready || !walletsReady || checking,
    authenticate, signIn: ensureSession, ensureSession, logout, deactivate, authenticateWithPrivy: authenticate, open: () => authenticated ? connectWallet({ walletChainType: 'solana-only' }) : login(),
    signMessage: async message => {
      if (!selected || selected.address !== authorizedAddress.current || selected.address !== currentAddress.current) throw new UserFacingError('Sign in with the selected wallet first.');
      const result = await signMessage({ message, wallet: selected });
      if (currentAddress.current !== selected.address) throw new UserFacingError('Wallet changed during approval.');
      return { publicKey: selected.address, signature: result.signature };
    },
    sendTransaction: async (transaction, address) => {
      if (!selected || selected.address !== address || authorizedAddress.current !== address || currentAddress.current !== address) throw new UserFacingError('Sign in with the selected wallet first.');
      await aliasConnection(); // Independently verify the configured RPC is devnet.
      if (currentAddress.current !== address) throw new UserFacingError('Wallet changed before payment approval.');
      const result = await signAndSendTransaction({ wallet: selected, chain: 'solana:devnet',
        transaction: transaction.serialize({ requireAllSignatures: false, verifySignatures: true }), options: { skipSimulation: false } });
      if (result.signature.length !== 64) throw new UserFacingError('Check wallet activity before retrying: no valid signature was returned.');
      return { signature: bs58.encode(result.signature) };
    } }}>{children}</WalletSessionContext.Provider>;
}
