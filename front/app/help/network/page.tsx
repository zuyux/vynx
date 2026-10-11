import type { Metadata } from 'next';
import { InformationPage } from '@/components/InformationPage';

export const metadata: Metadata = { title: 'Network Disclosure', description: 'VYNX network disclosure.', alternates: { canonical: '/help/network' } };

export default function Page() {
  return <InformationPage title="Network Disclosure"><section><h2>Solana devnet</h2><p>VYNX currently prepares and verifies alias, tip and sponsorship transactions on Solana devnet. Devnet is a testing network separate from mainnet. Its SOL and USDC are test tokens with no monetary value; devnet USDC is not redeemable for real dollars.</p><p>Use a wallet with Solana devnet support. In Phantom, enable Testnet Mode and select Solana Devnet, then reconnect. Check every wallet approval. Do not send mainnet funds to try to complete a devnet payment.</p></section>
<section><h2>Experimental network risks</h2><p>Devnet can experience outages, resets and data loss. Test balances, transactions and alias records are not a promise of permanent ownership or future mainnet rights. VYNX cannot guarantee network availability or a future mainnet launch.</p></section>
<section><h2>Public transactions and verification</h2><p>Wallet addresses, transfer amounts and transaction references are visible on the network. VYNX verifies transaction details before recording a payment. Sending and application verification are separate steps: a network delay does not mean you should pay twice. Keep the signature and use the verification retry flow.</p><p>Read the <a href="https://solana.com/docs/references/solana-cli" target="_blank" rel="noopener noreferrer">official Solana network guidance</a> or view transactions in <a href="https://explorer.solana.com/?cluster=devnet" target="_blank" rel="noopener noreferrer">Solana Explorer on devnet</a>.</p></section></InformationPage>;
}
