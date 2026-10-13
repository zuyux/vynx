import { localizeMetadata } from "@/i18n/metadata";

import { useCopy } from "@/i18n/copy";
import type { Metadata } from 'next';
import Link from '@/i18n/link';
import { InformationPage } from '@/components/InformationPage';
import { SUPPORT_EMAIL } from '@/lib/support';

const pageMetadata: Metadata = { title: 'Terms of Use', description: 'VYNX terms of use.', alternates: { canonical: '/help/terms' } };

export async function generateMetadata() { return localizeMetadata(pageMetadata, "/help/terms"); }

export default function Page() {
  const t = useCopy();
  return <InformationPage title={t("Terms of Use")}><section><h2>{t("Using VYNX")}</h2><p>{t("VYNX provides creator pages, alias registration, tips and sponsorship tools on Solana devnet. By using these features, you agree to these Terms. If you disagree, stop using the service. You must be legally able to agree to these Terms and follow laws that apply to you.")}</p></section>
<section><h2>{t("Your wallet and content")}</h2><p>{t("You control your wallet and approve its signatures. Keep your recovery phrase and private keys secret. VYNX does not ask for them or hold your funds. Sign-in messages do not transfer tokens; payment transactions do.")}</p><p>{t("You retain ownership of your content and give VYNX permission to store, display and distribute it to operate the features you use. Only submit content you have permission to publish. Do not impersonate others, publish unlawful or abusive material, distribute malware, or attempt to bypass security controls. VYNX may restrict access or remove content to address abuse or security issues.")}</p></section>
<section><h2>{t("Payments and sponsorships")}</h2><p>{t("All current payment flows use test tokens on devnet, with no monetary value. Review the ")}<Link href="/help/fees">{t("fee disclosure")}</Link>{t(" and ")}<Link href="/help/network">{t("network disclosure")}</Link>{t(" before signing. Tips and sponsorship payments go directly to the creator; VYNX does not provide escrow. Sponsorship publication begins after verification and lasts for the agreed period; it does not guarantee traffic, sales or endorsements.")}</p><p>{t("VYNX cannot reverse a confirmed blockchain transaction. There is no automatic refund mechanism. If verification fails after sending, keep the transaction signature and contact support before paying again. Any creator repayment is a separate transaction agreed with that creator.")}</p></section>
<section><h2>{t("Availability and responsibility")}</h2><p>{t("Devnet is an experimental environment. Features, aliases and availability may change or be interrupted, and third-party wallets, links and network services have their own terms. The service is provided as available, without promises of uninterrupted operation, token value or future mainnet availability. You remain responsible for checking transaction details and for your content. Nothing in these Terms excludes rights or responsibilities that applicable law does not allow to be excluded.")}</p></section>
<section><h2>{t("Changes and contact")}</h2><p>{t("Updates will be published here with a revised date. Review the current Terms when using the service. Questions, content reports and disputes can be sent to ")}<a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p></section></InformationPage>;
}
