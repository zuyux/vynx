"use client";
import { ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import WalletModalProviderWrapper from "./WalletModalProvider";

export default function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const endpoint = "https://api.mainnet-beta.solana.com";
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProviderWrapper>
          {children}
        </WalletModalProviderWrapper>
      </WalletProvider>
    </ConnectionProvider>
  );
}
