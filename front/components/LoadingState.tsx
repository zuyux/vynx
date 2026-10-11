export function LoadingState({ label = 'Loading your page…' }: { label?: string }) {
  return <div role="status" aria-live="polite" aria-busy="true" className="mx-auto w-full max-w-3xl p-6">
    <p className="text-sm text-zinc-300">{label}</p>
    <div aria-hidden="true" className="mt-6 space-y-4 motion-safe:animate-pulse">
      <div className="h-8 w-2/3 rounded-xl bg-white/10" />
      <div className="h-40 rounded-2xl bg-white/5" />
      <div className="h-20 rounded-2xl bg-white/5" />
    </div>
  </div>;
}
