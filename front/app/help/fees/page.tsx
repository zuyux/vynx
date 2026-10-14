import { localizeMetadata } from "@/i18n/metadata";

import { useCopy } from "@/i18n/copy";
import type { Metadata } from 'next';
import { InformationPage } from '@/components/InformationPage';
import { SUPPORT_EMAIL } from '@/lib/support';

const pageMetadata: Metadata = { title: 'Fee Disclosure', description: 'VYNX fee disclosure.', alternates: { canonical: '/help/fees' } };

export async function generateMetadata() { return localizeMetadata(pageMetadata, "/help/fees"); }

export default function Page() {
  const t = useCopy();
  return <InformationPage title={t("Fee Disclosure")}><section><h2>{t("Test tokens only")}</h2><p>{t("All amounts currently refer to Solana devnet SOL or devnet USDC, not real-money charges or redeemable dollars. Test tokens have no monetary value. VYNX does not request mainnet tokens for these flows.")}</p></section>
<section><h2>{t("Alias registration")}</h2><p>{t("VYNX currently sponsors on-chain alias registration, account rent and network fees on Solana devnet. Claim by signing with your connected wallet or Privy; no SOL balance is needed. Legacy claims still display their payable price before approval.")}</p></section>
<section><h2>{t("Creator tips")}</h2><p>{t("The selected tip amount goes directly to the creator’s verified wallet. VYNX currently deducts no platform commission from tips. Tips are accepted only in USDC. Network fees and creation of the receiving token account are sponsored.")}</p></section>
<section><h2>{t("Sponsorships")}</h2><p>{t("Submitting a proposal does not transfer tokens. After approval, the agreed USDC amount goes directly to the creator for the displayed publication period. VYNX currently deducts no platform commission from sponsorship payments. The paying wallet needs devnet SOL for network fees and any required token-account creation, in addition to devnet USDC. This flow has no escrow.")}</p></section>
<section><h2>{t("Before approving")}</h2><p>{t("Network and account-creation costs can vary. Review the recipient, amount, network and fee payer in your wallet. Failed transactions may still incur a network fee. If a transfer was sent but verification is pending, retry verification using its signature instead of sending another payment. Contact ")}<a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{t(" for help.")}</p></section></InformationPage>;
}
