import Link from 'next/link';

export function LegalLinks() {
  return <nav aria-label="Legal and support" className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
    <Link className="underline underline-offset-4" href="/help/terms">Terms</Link>
    <Link className="underline underline-offset-4" href="/help/privacy">Privacy</Link>
    <Link className="underline underline-offset-4" href="/help/fees">Fees</Link>
    <Link className="underline underline-offset-4" href="/help/network">Network</Link>
    <Link className="underline underline-offset-4" href="/support">Support</Link>
  </nav>;
}
