import type { Metadata } from 'next';
import Link from 'next/link';
import { InformationPage } from '@/components/InformationPage';
import { SUPPORT_EMAIL } from '@/lib/support';

export const metadata: Metadata = { title: 'Support', description: 'VYNX support.', alternates: { canonical: '/support' } };

export default function Page() {
  return <InformationPage title="Support"><section><h2>Contact VYNX</h2><p>For account help, failed payment verification, privacy requests or abuse reports, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. No response time is guaranteed.</p></section>
<section><h2>What to include</h2><p>Include your alias or public wallet address, the affected page, approximate time, error message and transaction signature if relevant. Send only the details needed to investigate. If a payment was sent, retry verification and contact us before sending another transfer.</p></section>
<section><h2>Keep your wallet safe</h2><p>Never email a recovery phrase, private key, password or session cookie. Support will never ask for them. To verify account ownership, we may ask for a wallet message signature that does not transfer funds. Check the message before signing.</p></section>
<section><h2>Helpful information</h2><p>Review our <Link href="/help/terms">Terms</Link>, <Link href="/help/privacy">Privacy Notice</Link>, <Link href="/help/fees">fee disclosure</Link> and <Link href="/help/network">network disclosure</Link>.</p></section></InformationPage>;
}
