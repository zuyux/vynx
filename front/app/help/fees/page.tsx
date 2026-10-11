import type { Metadata } from 'next';
import { InformationPage } from '@/components/InformationPage';
import { SUPPORT_EMAIL } from '@/lib/support';

export const metadata: Metadata = { title: 'Fee Disclosure', description: 'VYNX fee disclosure.', alternates: { canonical: '/help/fees' } };

export default function Page() {
  return <InformationPage title="Fee Disclosure"><section><h2>Test tokens only</h2><p>All amounts currently refer to Solana devnet SOL or devnet USDC, not real-money charges or redeemable dollars. Test tokens have no monetary value. VYNX does not request mainnet tokens for these flows.</p></section>
<section><h2>Alias registration</h2><p>The claim screen shows the registration price before approval. With the on-chain registry enabled, the quoted price includes account rent and VYNX sponsors the network fee. In the legacy claim flow, the displayed alias price is paid to the configured treasury and your wallet pays the network fee separately. Use the quote shown for your transaction rather than assuming a fixed price.</p></section>
<section><h2>Creator tips</h2><p>The selected tip amount goes directly to the creator’s verified wallet. VYNX currently deducts no platform commission from tips. Tips are accepted only in USDC. Network fees and creation of the receiving token account are sponsored.</p></section>
<section><h2>Sponsorships</h2><p>Submitting a proposal does not transfer tokens. After approval, the agreed USDC amount goes directly to the creator for the displayed publication period. VYNX currently deducts no platform commission from sponsorship payments. The paying wallet needs devnet SOL for network fees and any required token-account creation, in addition to devnet USDC. This flow has no escrow.</p></section>
<section><h2>Before approving</h2><p>Network and account-creation costs can vary. Review the recipient, amount, network and fee payer in your wallet. Failed transactions may still incur a network fee. If a transfer was sent but verification is pending, retry verification using its signature instead of sending another payment. Contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> for help.</p></section></InformationPage>;
}
