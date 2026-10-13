
import { useCopy } from "@/i18n/copy";
import Link from '@/i18n/link';

export function PaymentDisclosure() {
  const t = useCopy();
  return <p className="mt-3 text-xs leading-6 opacity-80">{t("Solana devnet · test tokens have no monetary value. Review ")}<Link href="/help/fees" className="underline">{t("fees")}</Link>, <Link href="/help/network" className="underline">{t("network details")}</Link>, <Link href="/help/terms" className="underline">{t("Terms")}</Link>{t(" and ")}<Link href="/help/privacy" className="underline">{t("Privacy")}</Link>{t(" before signing. ")}<Link href="/support" className="underline">{t("Need help?")}</Link></p>;
}
