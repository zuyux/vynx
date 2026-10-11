import Link from 'next/link';
import type { ReactNode } from 'react';

export function InformationPage({ title, children }: { title: string; children: ReactNode }) {
  return <main id="main-content" tabIndex={-1} className="w-full flex-1 bg-[#0A0A0A] px-6 py-12 text-white"><div className="mx-auto max-w-3xl">
    <Link href="/" className="text-violet-300 underline underline-offset-4">← VYNX home</Link>
    <h1 className="mt-8 text-4xl font-semibold tracking-tight">{title}</h1>
    <p className="mt-3 text-sm text-zinc-400">Last updated: October 10, 2026</p>
    <div className="mt-8 space-y-8 text-base leading-7 text-zinc-300 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_a]:text-violet-300 [&_a]:underline [&_p+p]:mt-3">{children}</div>
  </div></main>;
}
