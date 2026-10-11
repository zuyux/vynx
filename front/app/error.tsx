'use client';

import Link from 'next/link';

export default function PageError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center bg-[#07070a] p-6 text-white">
    <section role="alert" className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101015] p-8">
      <h1 className="text-2xl font-semibold">We couldn’t load this page</h1>
      <p className="mt-3 text-sm leading-6 text-zinc-400">Please try again in a moment, or return to the home page.</p>
      <div className="mt-6 flex flex-wrap gap-4">
        <button type="button" onClick={retry} className="rounded-xl bg-violet-300 px-5 py-3 font-semibold text-black">Try again</button>
        <Link href="/" className="rounded-xl border border-white/15 px-5 py-3">Go home</Link>
      </div>
    </section>
  </main>;
}
