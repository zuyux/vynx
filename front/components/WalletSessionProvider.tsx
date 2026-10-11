'use client';
import type { Transaction } from '@solana/web3.js';
import { createContext, useContext } from 'react';

export type PrivySignInOptions = { method: 'email' | 'google'; email?: string };
export type SessionContext = { wallet: string; connectedWallet: string; checking: boolean; authenticate: () => Promise<string>; signIn: () => Promise<string>; ensureSession: () => Promise<string>; logout: () => Promise<void>; open: () => void; signMessage: (message: Uint8Array) => Promise<{ publicKey: string; signature: Uint8Array }>; authenticateWithPrivy?: (options: PrivySignInOptions) => Promise<string>; deactivate?: () => Promise<void>; sendTransaction: (transaction: Transaction, address: string) => Promise<{ signature: string }> };
export const WalletSessionContext = createContext<SessionContext | null>(null);
export function useWalletSession() {
  const context = useContext(WalletSessionContext);
  if (!context) throw new Error('WalletSessionProvider is missing.');
  return context;
}
