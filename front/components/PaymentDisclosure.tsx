import Link from 'next/link';

export function PaymentDisclosure() {
  return <p className="mt-3 text-xs leading-6 opacity-80">Solana devnet · test tokens have no monetary value. Review <Link href="/help/fees" className="underline">fees</Link>, <Link href="/help/network" className="underline">network details</Link>, <Link href="/help/terms" className="underline">Terms</Link> and <Link href="/help/privacy" className="underline">Privacy</Link> before signing. <Link href="/support" className="underline">Need help?</Link></p>;
}
