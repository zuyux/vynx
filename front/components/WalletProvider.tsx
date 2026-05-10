"use client";
import { ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { TorusWalletAdapter } from "@solana/wallet-adapter-torus";
import { LedgerWalletAdapter } from "@solana/wallet-adapter-ledger";
import WalletModalProviderWrapper from "./WalletModalProvider";


export default function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const endpoint = "https://api.mainnet-beta.solana.com";
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
      new LedgerWalletAdapter(),
    ],
    []
  );


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
