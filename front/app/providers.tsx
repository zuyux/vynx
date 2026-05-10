"use client";

import { PhantomProvider, darkTheme } from "@phantom/react-sdk";
import { AddressType } from "@phantom/browser-sdk";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PhantomProvider
      config={{
        providers: ["google", "apple", "injected"],
        appId: "your-app-id", // TODO: Replace with your real appId from phantom.com/portal
        addressTypes: [AddressType.solana],
        authOptions: {
          redirectUrl: "https://yourapp.com/auth/callback",
        },
      }}
      theme={darkTheme}
      appName="Your App"
    >
      {children}
    </PhantomProvider>
  );
}
