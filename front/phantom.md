> ## Documentation Index
> Fetch the complete documentation index at: https://docs.phantom.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Next.js

> Step-by-step guide to integrating Phantom Connect in a Next.js App Router application.

Complete guide to integrating Phantom Connect in a Next.js application.

## 1. Install dependencies

```bash theme={null}
npm install @phantom/react-sdk @solana/web3.js
```

## 2. Create the provider

```tsx theme={null}
// app/providers.tsx
"use client";

import { PhantomProvider, darkTheme } from "@phantom/react-sdk";
import { AddressType } from "@phantom/browser-sdk";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PhantomProvider
      config={{
        providers: ["google", "apple", "injected"],
        appId: "your-app-id", // Get from phantom.com/portal
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
```

## 3. Wrap your layout

```tsx theme={null}
// app/layout.tsx
import { Providers } from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

## 4. Create the auth callback page

```tsx theme={null}
// app/auth/callback/page.tsx
"use client";

import { ConnectBox } from "@phantom/react-sdk";

export default function AuthCallback() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <ConnectBox />
    </div>
  );
}
```

## 5. Add connect button to your page

```tsx theme={null}
// app/page.tsx
"use client";

import { useModal, usePhantom, useAccounts, useDisconnect, useSolana } from "@phantom/react-sdk";

export default function Home() {
  const { open } = useModal();
  const { isConnected, isLoading } = usePhantom();
  const addresses = useAccounts();
  const { disconnect } = useDisconnect();
  const { solana } = useSolana();

  if (isLoading) return <p>Loading...</p>;

  if (isConnected && addresses) {
    return (
      <main>
        <p>Connected: {addresses[0]?.address}</p>
        <button onClick={() => solana.signMessage("Hello!")}>Sign Message</button>
        <button onClick={() => disconnect()}>Disconnect</button>
      </main>
    );
  }

  return (
    <main>
      <h1>Welcome</h1>
      <button onClick={open}>Connect Wallet</button>
    </main>
  );
}
```

## 6. Configure Phantom Portal

1. Go to [phantom.com/portal](https://phantom.com/portal)
2. Create or select your app
3. Add your domain to allowed URLs
4. Add `https://yourapp.com/auth/callback` to redirect URLs
5. Copy your App ID
