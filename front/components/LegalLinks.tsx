
import { useCopy } from "@/i18n/copy";
import Link from '@/i18n/link';

export function LegalLinks() {
  const t = useCopy();
  return <nav aria-label={t("Resources and legal")} className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
    <a className="underline underline-offset-4" href="https://youtu.be/FPPyr83ccXM" target="_blank" rel="noopener noreferrer">{t("Demo")}</a>
    <a className="underline underline-offset-4" href="https://youtu.be/uxWt4cdVUjI" target="_blank" rel="noopener noreferrer">{t("Pitch Deck")}</a>
    <Link className="underline underline-offset-4" href="/docs">{t("Docs")}</Link>
    <Link className="underline underline-offset-4" href="/brand">{t("Brand Kit")}</Link>
    <Link className="underline underline-offset-4" href="/help/terms">{t("Terms")}</Link>
    <Link className="underline underline-offset-4" href="/help/privacy">{t("Privacy")}</Link>
  </nav>;
}
