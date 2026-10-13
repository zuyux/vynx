import { useCopy } from '@/i18n/copy';

export function CreatorCardSkeleton() {
  const t = useCopy();

  return <div role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">{t('Loading creator card…')}</span>
    <div aria-hidden="true" className="mx-auto max-w-[460px]">
      <div className="relative flex aspect-[1/1.618] w-full flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#101012] shadow-[0_24px_80px_-24px_#000000] motion-safe:animate-pulse">
        <div className="absolute inset-x-0 top-0 h-[55%] bg-gradient-to-b from-white/5 to-transparent" />
        <div className="relative flex flex-1 flex-col justify-end px-5 pb-5 sm:px-6 sm:pb-6">
          <div className="h-8 w-2/3 rounded-lg bg-white/10" />
          <div className="mt-2 h-4 w-1/3 rounded-md bg-white/10" />
          <div className="mt-3 space-y-2">
            <div className="h-4 w-full rounded-md bg-white/10" />
            <div className="h-4 w-4/5 rounded-md bg-white/10" />
          </div>
          <div className="mt-5 flex justify-center gap-1 sm:gap-3">
            {[0, 1, 2, 3].map(index => <div key={index} className="size-11 rounded-xl border border-white/10 bg-white/5" />)}
          </div>
        </div>
      </div>
    </div>
  </div>;
}
