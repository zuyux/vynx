import { localizeMetadata } from "@/i18n/metadata";

import { useCopy } from "@/i18n/copy";
import type { Metadata } from 'next';
import { InformationPage } from '@/components/InformationPage';

const pageMetadata: Metadata = { title: 'Network Disclosure', description: 'VYNX network disclosure.', alternates: { canonical: '/help/network' } };

export async function generateMetadata() { return localizeMetadata(pageMetadata, "/help/network"); }

export default function Page() {
  const t = useCopy();
  return <InformationPage title={t("Network Disclosure")}><section><h2>{t("Solana devnet")}</h2><p>{t("VYNX currently prepares and verifies alias, tip and sponsorship transactions on Solana devnet. Devnet is a testing network separate from mainnet. Its SOL and USDC are test tokens with no monetary value; devnet USDC is not redeemable for real dollars.")}</p><p>{t("Use a wallet with Solana devnet support. In Phantom, enable Testnet Mode and select Solana Devnet, then reconnect. Check every wallet approval. Do not send mainnet funds to try to complete a devnet payment.")}</p></section>
<section><h2>{t("Experimental network risks")}</h2><p>{t("Devnet can experience outages, resets and data loss. Test balances, transactions and alias records are not a promise of permanent ownership or future mainnet rights. VYNX cannot guarantee network availability or a future mainnet launch.")}</p></section>
<section><h2>{t("Public transactions and verification")}</h2><p>{t("Wallet addresses, transfer amounts and transaction references are visible on the network. VYNX verifies transaction details before recording a payment. Sending and application verification are separate steps: a network delay does not mean you should pay twice. Keep the signature and use the verification retry flow.")}</p><p>{t("Read the ")}<a href="https://solana.com/docs/references/solana-cli" target="_blank" rel="noopener noreferrer">{t("official Solana network guidance")}</a>{t(" or view transactions in ")}<a href="https://explorer.solana.com/?cluster=devnet" target="_blank" rel="noopener noreferrer">{t("Solana Explorer on devnet")}</a>.</p></section></InformationPage>;
}
