
import { useCopy } from "@/i18n/copy";
export function LoadingState({ label, fullPage = false }: { label?: string; fullPage?: boolean }) {
  const t = useCopy();
  return <div role="status" aria-live="polite" aria-busy="true" className={`mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-4 p-6 ${fullPage ? 'min-h-[calc(100svh-4rem)]' : 'min-h-40'}`}>
    <span aria-hidden="true" className="relative flex size-12 items-center justify-center">
      <span className="absolute inset-0 rounded-full border-[3px] border-white/15" />
      <span className="absolute inset-0 rounded-full border-[3px] border-transparent border-r-white/40 border-t-white motion-safe:animate-spin" />
    </span>
    <p className="sr-only">{t(label ?? 'Loading…')}</p>
  </div>;
}
