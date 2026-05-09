"use client";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

export default function WalletModalProviderWrapper({ children }: { children: React.ReactNode }) {
  return <WalletModalProvider>{children}</WalletModalProvider>;
}
