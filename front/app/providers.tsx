"use client";

import { useEffect, useState } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
import { PrivyWalletSessionProvider } from '@/components/PrivyWalletSessionProvider';
import { MotionConfig } from "framer-motion";
import { AuthMethodProvider } from "@/components/AuthMethodProvider";

export function Providers({ children, privyAppId }: { children: React.ReactNode; privyAppId?: string }) {
  const [configuration, setConfiguration] = useState({ appId: privyAppId, loaded: !!privyAppId });
  useEffect(() => {
    if (privyAppId) return;
    const controller = new AbortController();
    // Recover the public ID at runtime when an older/static shell omitted it.
    void fetch('/api/auth/config', { cache: 'no-store', signal: controller.signal })
      .then(async response => response.ok ? response.json() : { privyAppId: null })
      .then(config => { if (!controller.signal.aborted) setConfiguration({ appId: typeof config.privyAppId === 'string' ? config.privyAppId : undefined, loaded: true }); })
      .catch(() => { if (!controller.signal.aborted) setConfiguration({ appId: undefined, loaded: true }); });
    return () => controller.abort();
  }, [privyAppId]);
  const appId = privyAppId || configuration.appId;
  if (appId) {
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() || 'https://api.devnet.solana.com';
    const subscriptionsUrl = rpcUrl.replace(/^http/, 'ws');
    return <PrivyProvider appId={appId} config={{
      loginMethods: ['wallet', 'email', 'google'],
      appearance: { theme: 'dark', accentColor: '#a78bfa', walletChainType: 'solana-only' },
      externalWallets: { solana: { connectors: toSolanaWalletConnectors({ shouldAutoConnect: false }) } },
      embeddedWallets: { solana: { createOnLogin: 'users-without-wallets' } },
      solana: { rpcs: { 'solana:devnet': { rpc: createSolanaRpc(rpcUrl), rpcSubscriptions: createSolanaRpcSubscriptions(subscriptionsUrl) } } },
    }}><MotionConfig reducedMotion="user"><PrivyWalletSessionProvider><AuthMethodProvider>{children}</AuthMethodProvider></PrivyWalletSessionProvider></MotionConfig></PrivyProvider>;
  }
  return <MotionConfig reducedMotion="user"><AuthMethodProvider privyLoading={!configuration.loaded}>{children}</AuthMethodProvider></MotionConfig>;
}
