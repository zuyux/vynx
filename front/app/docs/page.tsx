import { localizeMetadata } from "@/i18n/metadata";

import { useCopy } from "@/i18n/copy";
import type { Metadata } from 'next';
import Link from '@/i18n/link';
import { SUPPORT_EMAIL } from '@/lib/support';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';

const pageMetadata: Metadata = {
  title: 'Documentation',
  description: 'Get started with VYNX and learn about creator offers, fees, network payments, and support.',
  alternates: { canonical: '/docs' },
};

const sections = [
  { title: 'Get your card', url: '#get-your-card', depth: 2 },
  { title: 'Make it yours', url: '#make-it-yours', depth: 2 },
  { title: 'Share and receive tips', url: '#share-and-receive-tips', depth: 2 },
  { title: 'Creator offers', url: '#creator-offers', depth: 2 },
  { title: 'Fees', url: '#fees', depth: 2 },
  { title: 'Network and payments', url: '#network-and-payments', depth: 2 },
  { title: 'Support', url: '#support', depth: 2 },
  { title: 'Resources', url: '#resources', depth: 2 },
];

export async function generateMetadata() { return localizeMetadata(pageMetadata, "/docs"); }

export default function Page() {
  const t = useCopy();
  return <DocsPage id="main-content" tabIndex={-1} toc={sections.map(section => ({ ...section, title: t(section.title) }))}>
    <DocsTitle>{t("Getting started with VYNX")}</DocsTitle>
    <DocsDescription>{t("Your creator identity, links, and offers in one shareable card.")}</DocsDescription>
    <DocsBody>
      <p>{t("VYNX gives creators a public card to share their profile, receive USDC tips, and offer ways to connect with their audience.")}</p>
      <h2 id="get-your-card">{t("Get your card")}</h2>
      <ol><li>{t("Open ")}<Link href="/">{t("VYNX")}</Link>{t(" and choose a sign-in method.")}</li><li>{t("Follow onboarding to choose and claim your alias. Review the displayed quote before approving a transaction.")}</li><li>{t("Open your dashboard to set up your creator card.")}</li></ol>
      <h2 id="make-it-yours">{t("Make it yours")}</h2>
      <p>{t("Add your profile image, bio, and social links in the ")}<Link href="/dashboard/card">{t("card editor")}</Link>{t(". Preview your card, then publish it when it is ready to share.")}</p>
      <h2 id="share-and-receive-tips">{t("Share and receive tips")}</h2>
      <p>{t("Your public card lives at ")}<code>/{t('{your-alias}')}</code>{t(". Share that link with your audience. Visitors can send USDC tips to your verified wallet through your card.")}</p>
      <h2 id="creator-offers">{t("Creator offers")}</h2>
      <p>{t("Use the dashboard to configure the offers available on your card, including calls, monthly plans, products, tickets, and sponsorships. Review the details and availability of each offer before publishing.")}</p>
      <h2 id="fees">{t("Fees")}</h2>
      <h3>{t("Test tokens only")}</h3><p>{t("All amounts currently refer to Solana devnet SOL or devnet USDC, not real-money charges or redeemable dollars. Test tokens have no monetary value. VYNX does not request mainnet tokens for these flows.")}</p>
      <h3>{t("Alias registration")}</h3><p>{t("The claim screen shows the registration price before approval. With the on-chain registry enabled, the quoted price includes account rent and VYNX sponsors the network fee. In the legacy claim flow, the displayed alias price is paid to the configured treasury and your wallet pays the network fee separately. Use the quote shown for your transaction rather than assuming a fixed price.")}</p>
      <h3>{t("Creator tips")}</h3><p>{t("The selected tip amount goes directly to the creator’s verified wallet. VYNX currently deducts no platform commission from tips. Tips are accepted only in USDC. Network fees and creation of the receiving token account are sponsored.")}</p>
      <h3>{t("Sponsorships")}</h3><p>{t("Submitting a proposal does not transfer tokens. After approval, the agreed USDC amount goes directly to the creator for the displayed publication period. VYNX currently deducts no platform commission from sponsorship payments. The paying wallet needs devnet SOL for network fees and any required token-account creation, in addition to devnet USDC. This flow has no escrow.")}</p>
      <h3>{t("Before approving")}</h3><p>{t("Network and account-creation costs can vary. Review the recipient, amount, network and fee payer in your wallet. Failed transactions may still incur a network fee. If a transfer was sent but verification is pending, retry verification using its signature instead of sending another payment. Contact ")}<a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{t(" for help.")}</p>
      <h2 id="network-and-payments">{t("Network and payments")}</h2>
      <h3>{t("Solana devnet")}</h3><p>{t("VYNX currently prepares and verifies alias, tip and sponsorship transactions on Solana devnet. Devnet is a testing network separate from mainnet. Its SOL and USDC are test tokens with no monetary value; devnet USDC is not redeemable for real dollars.")}</p><p>{t("Use a wallet with Solana devnet support. In Phantom, enable Testnet Mode and select Solana Devnet, then reconnect. Check every wallet approval. Do not send mainnet funds to try to complete a devnet payment.")}</p>
      <h3>{t("Experimental network risks")}</h3><p>{t("Devnet can experience outages, resets and data loss. Test balances, transactions and alias records are not a promise of permanent ownership or future mainnet rights. VYNX cannot guarantee network availability or a future mainnet launch.")}</p>
      <h3>{t("Public transactions and verification")}</h3><p>{t("Wallet addresses, transfer amounts and transaction references are visible on the network. VYNX verifies transaction details before recording a payment. Sending and application verification are separate steps: a network delay does not mean you should pay twice. Keep the signature and use the verification retry flow.")}</p><p>{t("Read the ")}<a href="https://solana.com/docs/references/solana-cli" target="_blank" rel="noopener noreferrer">{t("official Solana network guidance")}</a>{t(" or view transactions in ")}<a href="https://explorer.solana.com/?cluster=devnet" target="_blank" rel="noopener noreferrer">{t("Solana Explorer on devnet")}</a>.</p>
      <h2 id="support">{t("Support")}</h2>
      <h3>{t("Contact VYNX")}</h3><p>{t("For account help, failed payment verification, privacy requests or abuse reports, email ")}<a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{t(". No response time is guaranteed.")}</p>
      <h3>{t("What to include")}</h3><p>{t("Include your alias or public wallet address, the affected page, approximate time, error message and transaction signature if relevant. Send only the details needed to investigate. If a payment was sent, retry verification and contact us before sending another transfer.")}</p>
      <h3>{t("Keep your wallet safe")}</h3><p>{t("Never email a recovery phrase, private key, password or session cookie. Support will never ask for them. To verify account ownership, we may ask for a wallet message signature that does not transfer funds. Check the message before signing.")}</p>
      <h3>{t("Helpful information")}</h3><p>{t("Review our ")}<Link href="/help/terms">{t("Terms")}</Link>, <Link href="/help/privacy">{t("Privacy Notice")}</Link>, <Link href="#fees">{t("fee disclosure")}</Link>{t(" and ")}<Link href="#network-and-payments">{t("network disclosure")}</Link>.</p>
      <h2 id="resources">{t("Resources")}</h2>
      <ul><li><a href="https://youtu.be/FPPyr83ccXM" target="_blank" rel="noopener noreferrer">{t("Watch the demo")}</a></li><li><a href="https://youtu.be/uxWt4cdVUjI" target="_blank" rel="noopener noreferrer">{t("View the pitch deck")}</a></li><li><Link href="/brand">{t("Download brand assets")}</Link></li><li><Link href="#support">{t("Get support")}</Link></li></ul>
    </DocsBody>
  </DocsPage>;
}
