import { localizeMetadata } from "@/i18n/metadata";

import { useCopy } from "@/i18n/copy";
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from '@/i18n/link';
import { BrandLogo } from '@/components/BrandLogo';
import { SITE_MOTTO } from '@/lib/brand';

const pageMetadata: Metadata = {
  title: 'Brand Kit',
  description: 'Download VYNX logos and brand assets.',
  alternates: { canonical: '/brand' },
};

const assets = [
  { name: 'Primary mark', file: '/logo.svg', format: 'SVG', light: true },
  { name: 'White mark', file: '/logo-white.svg', format: 'SVG', light: false },
  { name: 'Signature glow', file: '/logo.png', format: 'PNG', light: false },
  { name: 'White mark · raster', file: '/logo-white.png', format: 'PNG', light: false },
  { name: 'Black mark', file: '/logo-blak.png', format: 'PNG', light: true },
  { name: 'Rounded mark', file: '/logo-rounded.png', format: 'PNG', light: true },
  { name: 'Sharp mark', file: '/logo-sharp.png', format: 'PNG', light: true },
  { name: 'Frame mark', file: '/logo-frame.png', format: 'PNG', light: false },
  { name: 'Magenta mark', file: '/logo-mag.png', format: 'PNG', light: false },
  { name: 'Glass mark', file: '/logo-glass.jpg', format: 'JPG', light: false },
];

export async function generateMetadata() { return localizeMetadata(pageMetadata, "/brand"); }

export default function Page() {
  const t = useCopy();
  return <main id="main-content" tabIndex={-1} className="w-full flex-1 bg-[#0A0A0A] px-6 py-10 text-white sm:px-10">
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between"><BrandLogo /><Link href="/" className="text-sm text-zinc-300 underline underline-offset-4">{t("Back to VYNX")}</Link></div>
      <header className="py-16"><p className="text-sm font-medium uppercase tracking-[0.2em] text-violet-300">{t("VYNX / Brand assets")}</p><h1 className="heading-font mt-4 text-5xl sm:text-7xl">{t("Brand Kit")}</h1><p className="mt-6 max-w-xl text-lg leading-8 text-zinc-400">{t(SITE_MOTTO)}{t(". Download our logos for your stories, presentations, and collaborations.")}</p></header>
      <section aria-labelledby="logos-title"><h2 id="logos-title" className="mb-6 text-2xl font-semibold">{t("Logo library")}</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{assets.map(asset => <article key={asset.file} className="overflow-hidden rounded-2xl border border-white/10">
          <div className={`relative flex h-56 items-center justify-center p-10 ${asset.light ? 'bg-zinc-100' : 'bg-[#151515]'}`}><Image src={asset.file} alt={t("VYNX {v0}", {v0: asset.name.toLowerCase()})} width={240} height={160} className="h-full w-full object-contain" /></div>
          <div className="p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-medium">{t(asset.name)}</h3><span className="text-xs text-zinc-500">{asset.format}</span></div><a href={asset.file} download className="mt-4 inline-flex rounded-lg border border-white/15 px-4 py-2 text-sm text-violet-300 transition-colors hover:border-violet-400 hover:bg-white/5" aria-label={t("Download {v0} ({v1})", {v0: asset.name, v1: asset.format})}>{t("Download ")}{asset.format} ↓</a></div>
        </article>)}</div>
      </section>
      <section className="my-14 max-w-2xl space-y-4"><h2 className="text-2xl font-semibold">{t("Using the VYNX mark")}</h2><p className="leading-7 text-zinc-400">{t("Keep the original proportions and give the logo room to breathe. Choose a version with clear contrast against your background. Use the supplied files without stretching, recoloring, or adding effects.")}</p></section>
    </div>
  </main>;
}
