import { localizeMetadata } from "@/i18n/metadata";

import { useCopy } from "@/i18n/copy";
import type { Metadata } from 'next';
import Link from '@/i18n/link';
import { InformationPage } from '@/components/InformationPage';
import { SUPPORT_EMAIL } from '@/lib/support';

const pageMetadata: Metadata = { title: 'Support', description: 'VYNX support.', alternates: { canonical: '/support' } };

export async function generateMetadata() { return localizeMetadata(pageMetadata, "/support"); }

export default function Page() {
  const t = useCopy();
  return <InformationPage title={t("Support")}><section><h2>{t("Contact VYNX")}</h2><p>{t("For account help, failed payment verification, privacy requests or abuse reports, email ")}<a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{t(". No response time is guaranteed.")}</p></section>
<section><h2>{t("What to include")}</h2><p>{t("Include your alias or public wallet address, the affected page, approximate time, error message and transaction signature if relevant. Send only the details needed to investigate. If a payment was sent, retry verification and contact us before sending another transfer.")}</p></section>
<section><h2>{t("Keep your wallet safe")}</h2><p>{t("Never email a recovery phrase, private key, password or session cookie. Support will never ask for them. To verify account ownership, we may ask for a wallet message signature that does not transfer funds. Check the message before signing.")}</p></section>
<section><h2>{t("Helpful information")}</h2><p>{t("Review our ")}<Link href="/help/terms">{t("Terms")}</Link>, <Link href="/help/privacy">{t("Privacy Notice")}</Link>, <Link href="/help/fees">{t("fee disclosure")}</Link>{t(" and ")}<Link href="/help/network">{t("network disclosure")}</Link>.</p></section></InformationPage>;
}
