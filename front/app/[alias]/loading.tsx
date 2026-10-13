
import { useCopy } from "@/i18n/copy";
import { LoadingState } from '@/components/LoadingState';

export default function Loading() {
  const t = useCopy();
  return <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#07070a] py-8 text-white"><LoadingState label={t("Loading creator card…")} /></main>;
}
