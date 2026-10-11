"use client";

import { MotionConfig } from "framer-motion";
import { useLayoutEffect } from "react";
import { PhantomProvider, darkTheme, type PhantomSDKConfig } from "@phantom/react-sdk";
import { AddressType } from "@phantom/browser-sdk";
import { WalletSessionProvider } from "@/components/WalletSessionProvider";

const appId = process.env.NEXT_PUBLIC_PHANTOM_APP_ID?.trim() || undefined;
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const walletConfig: PhantomSDKConfig = {
  providers: appId ? ["google", "apple", "injected"] : ["injected"],
  appId,
  addressTypes: [AddressType.solana],
  authOptions: {
    redirectUrl: `${appUrl}/auth/callback`,
  },
};

export function Providers({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    // React SDK 2.0.3 calls autoConnect unconditionally in a passive effect.
    // Clear its injected-wallet reconnect flag before that effect runs, so
    // revisiting the site cannot request wallet authorization. Explicit
    // connections and embedded OAuth callbacks continue through the SDK.
    try {
      localStorage.removeItem("phantom-injected-was-connected");
    } catch {
      // The SDK also skips injected auto-connect when storage is unavailable.
    }
  }, []);

  return (
    <PhantomProvider
      config={walletConfig}
      theme={darkTheme}
      appName="VYNX"
    >
      <MotionConfig reducedMotion="user"><WalletSessionProvider>{children}</WalletSessionProvider></MotionConfig>
    </PhantomProvider>
  );
}
