'use client';
import { useCopy } from "@/i18n/copy";

import { CREATOR_ACCENTS } from '@/lib/creator-draft';
import { SITE_MOTTO } from '@/lib/brand';
import CallBookingPanel from './CallBookingPanel';
import { Instagram, Tiktok, Youtube } from '@/components/CardIcons';

import Image from 'next/image';
import Link from '@/i18n/link';
import { BrandLogo } from '@/components/BrandLogo';
import { ArrowLeft, ArrowUpRight, Check, Clock3, Globe, Link2, Pause, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import SponsorshipWalletControl from '@/components/SponsorshipWalletControl';
import { useSponsorshipWallet } from '@/lib/use-sponsorship-wallet';
import { safeLink, type CreatorDraft } from '@/lib/creator-draft';
import { money, type SponsorProfile } from '@/lib/sponsorship-domain';

export type PublicAd = { id: string; brand_name: string; headline: string; description: string; destination_url: string; ends_at: string };
const input = 'mt-2 w-full rounded-xl border border-current/15 bg-current/5 px-4 py-3 text-sm outline-none placeholder:opacity-70 focus:ring-2 focus:ring-violet-400';

export function CreatorPublicView({ profile, ad, design, preview = false, onRequest, busy = false, notice = '', failed = false }: {
  profile: SponsorProfile; ad: PublicAd | null; design?: CreatorDraft; preview?: boolean;
  onRequest?: (event: FormEvent<HTMLFormElement>) => void; busy?: boolean; notice?: string; failed?: boolean;
}) {
  const t = useCopy();
  const { wallet, open } = useSponsorshipWallet();
  const [description, setDescription] = useState('');
  const accent = design ? CREATOR_ACCENTS[design.accent] : '#00F5A0';
  const light = design?.theme === 'light';
  const card = `rounded-3xl border border-current/10 ${light ? 'bg-white' : 'bg-[#101015]'}`;
  const button = `inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition hover:brightness-110 disabled:opacity-70 ${design?.rounded === false ? 'rounded-md' : 'rounded-xl'}`;
  const links = design?.links ?? (profile.website ? [{id:'website',title:t('My website and projects'),url:profile.website}] : []);
  const socials = design ? Object.entries(design.socials).filter(([,url]) => safeLink(url)) : [];
  const ownPage = wallet === profile.wallet;

  return <main id="main-content" tabIndex={-1} className={`min-h-screen px-5 py-6 sm:px-8 ${light ? 'bg-[#f5f5f7] text-zinc-900' : 'bg-[#07070a] text-white'}`}>
    <div className="mx-auto max-w-6xl">
      <nav aria-label={t("Public page navigation")} className="mb-8 flex flex-wrap items-center justify-between gap-4"><BrandLogo light={light} /><div className="flex flex-wrap items-center gap-4">{preview ? <Link href="/dashboard/card" className="inline-flex items-center gap-2 text-sm opacity-70"><ArrowLeft size={15} />{t("Back to editor")}</Link> : <><Link href="/dashboard/sponsorships" className="text-xs opacity-70">{t("My sponsorships ↗")}</Link><SponsorshipWalletControl /></>}</div></nav>
      {preview && <p role="status" className="mb-6 rounded-xl border border-violet-400/30 bg-violet-400/10 p-4 text-sm leading-6">{t("Local preview · only you can see this draft in this browser. It is unpublished and does not accept proposals. Set the price in Sponsorships.")}</p>}
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <section className={`${card} overflow-hidden`}>
            <div className="relative h-40 overflow-hidden sm:h-52" style={{background:`linear-gradient(120deg, ${accent}55, #362056 60%, #17151e)`}}>{design?.cover ? <Image src={design.cover} alt={t("Creator cover")} fill unoptimized sizes="(max-width:1024px) 100vw, 650px" className="object-cover" /> : <div aria-hidden="true" className="absolute -right-12 -top-20 size-80 rounded-full border-[45px] border-white/5" />}</div>
            <div className="relative -mt-12 px-6 pb-7 sm:px-8 sm:pb-8"><div className={`relative flex size-24 items-center justify-center overflow-hidden rounded-3xl border-4 ${light ? 'border-white bg-zinc-100' : 'border-[#101015] bg-[#202027]'}`}>{design?.avatar ? <Image src={design.avatar} alt={t("Photo of {v0}", {v0: profile.display_name})} fill sizes="96px" unoptimized className="object-cover" /> : <span className="text-3xl font-semibold" style={{color:light ? "#6240a6" : accent}}>{profile.display_name.slice(0,1).toUpperCase() || <UserRound size={32} />}</span>}</div>
              <p className="mt-5 break-all text-xs font-medium" style={{color:light ? '#6240a6' : accent}}>@{profile.alias}</p><h1 className="mt-2 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{profile.display_name}</h1><p className="mt-4 whitespace-pre-line break-words text-sm leading-7 opacity-70">{profile.bio || t("A space to share what I create and connect with my community.")}</p>
              {socials.length > 0 && <nav aria-label={t("Creator social links")} className="mt-5 flex flex-wrap gap-2">{socials.map(([network,url]) => <a key={network} href={safeLink(url)!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-current/15 px-3 py-2 text-xs opacity-70 hover:opacity-100">{network === 'instagram' ? <Instagram size={18} /> : network === 'youtube' ? <Youtube size={18} /> : network === 'tiktok' ? <Tiktok size={18} /> : <span aria-hidden="true">𝕏</span>}{network === 'x' ? t('X') : network === 'youtube' ? t('YouTube') : network === 'tiktok' ? t('TikTok') : t('Instagram')}<span className="sr-only">{t(", opens in a new tab")}</span></a>)}</nav>}
              {links.length > 0 && <div className="mt-6 space-y-3">{links.filter(link => safeLink(link.url)).map(link => <a key={link.id} href={safeLink(link.url)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-current/10 px-4 py-4 text-sm transition hover:bg-current/5"><Globe size={18} className="shrink-0 opacity-70" aria-hidden="true" /><span className="min-w-0 flex-1 break-words">{t(link.title)}</span><ArrowUpRight size={17} aria-hidden="true" className="shrink-0 opacity-70" /></a>)}</div>}
            </div>
          </section>
          <section className={`${card} p-6 sm:p-8`}>
            {ad ? <><div className="flex flex-wrap items-center justify-between gap-3"><span className="inline-flex items-center gap-2 rounded-full bg-violet-400/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest"><Sparkles size={12} />{t("Sponsored")}</span><span className="text-xs opacity-70">{t("Selected by the creator")}</span></div><p className="mt-6 break-words text-xs font-medium opacity-70">{ad.brand_name}</p><h2 className="mt-2 break-words text-2xl font-semibold">{ad.headline}</h2><p className="mt-3 break-words text-sm leading-7 opacity-70">{t(ad.description)}</p><a href={ad.destination_url} target="_blank" rel="noopener noreferrer sponsored" className={`${button} mt-6 text-black`} style={{background:accent}}>{t("Explore the brand")}<ArrowUpRight size={16} /></a></> : <><span className="inline-flex items-center gap-2 text-xs opacity-70"><Sparkles size={16} aria-hidden="true" />{t("Collaborations with purpose")}</span><h2 className="mt-4 text-2xl font-semibold">{profile.accepting ? t("Your brand, part of this space.") : t("Every collaboration in its own time.")}</h2><p className="mt-3 text-sm leading-7 opacity-70">{profile.accepting ? t("A proposal that connects with this community. An ad selected by the creator and published here for the agreed period.") : t("This creator has paused proposals. Explore their links and return later.")}</p>{profile.accepting && <a href="#propuesta" className="mt-5 inline-flex items-center gap-2 text-sm font-medium">{t("Explore the offer")}<ArrowUpRight size={16} /></a>}</>}
          </section><p className="px-2 text-xs leading-6 opacity-70">{t("Sponsorships appear on this Vynx page. They are not automatically posted to the creator’s social networks.")}</p>
        </div>
        <section id="propuesta" className={`${card} min-w-0 self-start scroll-mt-6 p-6 sm:p-8 lg:sticky lg:top-6`}>
          <span className="inline-flex items-center gap-2 rounded-full border border-current/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest"><span className={`size-1.5 rounded-full ${profile.accepting ? 'bg-emerald-400' : 'bg-amber-400'}`} />{preview ? t("Offer to be configured") : profile.accepting ? t('Accepting proposals') : t('Proposals paused')}</span><h2 className="mt-5 text-2xl font-semibold">{t("Collaborate with this creator")}</h2><p className="mt-2 text-sm leading-6 opacity-70">{t("An exclusive space. One brand at a time.")}</p>
          <div className="my-6 border-y border-current/10 py-5"><p className="text-3xl font-semibold tracking-tight">{preview ? t("Price to be set") : money(profile.price_cents)}{!preview && <span className="ml-2 text-sm font-normal opacity-70">{t("test USDC")}</span>}</p><p className="mt-3 inline-flex items-center gap-2 text-xs opacity-70"><Clock3 size={14} aria-hidden="true" />{preview ? t("Duration to be set") : `${profile.duration_days} days of publication from verified payment`}</p></div>
          <ol className="mb-6 grid grid-cols-3 gap-2 text-[10px] opacity-70">{[t("Send your proposal"),t("The creator approves"),t('Pay and publish')].map((label,index) => <li key={label}><span className="mb-2 flex size-6 items-center justify-center rounded-full border border-current/15">{index + 1}</span>{t(label)}</li>)}</ol>
          <p className="rounded-xl bg-violet-400/10 p-3 text-xs leading-5 opacity-70">{t("Solana devnet · tokens have no monetary value. The price covers the publication period; it does not guarantee visits or sales.")}</p>
          {preview ? <div className="mt-6 rounded-xl border border-dashed border-current/15 p-5 text-sm leading-6 opacity-70">{t("Brands can send you a proposal here once you publish your offer.")}<Link href="/dashboard/sponsorships" className="mt-3 flex items-center gap-2 font-medium">{t("Set up my offer")}<ArrowUpRight size={15} /></Link></div> : !profile.accepting ? <div className="mt-6 flex gap-3 rounded-xl border border-current/10 p-4"><Pause size={19} className="shrink-0 opacity-70" aria-hidden="true" /><p className="text-sm leading-6 opacity-70">{t("Proposals are paused. Return later to collaborate.")}</p></div> : ownPage ? <div className="mt-6 text-sm leading-6 opacity-70">{t("This is your page. Review proposals and manage your offer from the dashboard.")}<Link href="/dashboard/sponsorships" className="mt-4 flex items-center gap-2 font-medium">{t("Manage sponsorships")}<ArrowUpRight size={15} /></Link></div> : notice && !failed ? <div role="status" className="mt-6 rounded-xl border border-emerald-400/30 p-5"><Check size={22} className="mb-3 text-emerald-400" aria-hidden="true" /><p className="text-sm leading-6">{t(notice)}</p><Link href="/dashboard/sponsorships" className="mt-4 inline-flex items-center gap-2 text-sm font-medium">{t("Follow my proposal")}<ArrowUpRight size={15} /></Link></div> : <form onSubmit={event => { onRequest?.(event); }} className="mt-6 space-y-4">
            <fieldset disabled={busy} className="space-y-4 disabled:opacity-70"><legend className="mb-4 text-sm font-semibold">{t("Your proposal")}</legend><label className="block text-xs">{t("Your brand name")}<input name="brand_name" required maxLength={60} placeholder={t("Your brand")} className={input} autoComplete="organization" /></label><label className="block text-xs">{t("Ad headline")}<input name="headline" required maxLength={100} placeholder={t("An idea that connects with this community")} className={input} /></label><label className="block text-xs">{t("Description")}<textarea name="description" required maxLength={240} rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder={t("Explain what you offer and why it fits here")} className={`${input} resize-y`} /><span className="mt-1 block text-right text-[10px] opacity-70">{description.length} / 240</span></label><label className="block text-xs">{t("Destination URL")}<input name="destination_url" required type="url" maxLength={500} pattern="https://.*" placeholder="https://your-brand.com" className={input} /><span className="mt-2 block text-[10px] opacity-70">{t("The destination for your ad. Use HTTPS.")}</span></label>
              {wallet ? <button disabled={busy} className={`${button} w-full text-black`} style={{background:accent}}>{busy ? t('Sending proposal…') : t("Send proposal · no payment")}{!busy && <ArrowUpRight size={16} />}</button> : <button type="button" onClick={open} className={`${button} w-full text-black`} style={{background:accent}}>{t("Connect wallet to propose")}<ArrowUpRight size={16} /></button>}
            </fieldset>{notice && <p role={failed ? 'alert' : 'status'} className={`rounded-xl border p-3 text-xs leading-6 ${failed ? 'border-red-400/30 text-red-400' : 'border-emerald-400/30 text-emerald-500'}`}>{!failed && <Check size={15} className="mb-1" />}{t(notice)}</p>}
          </form>}
          <p className="mt-5 flex items-start gap-2 text-[10px] leading-5 opacity-70"><ShieldCheck size={14} className="mt-0.5 shrink-0" />{t("Explore without a wallet. Connecting lets you sign your proposal; payment happens after approval.")}</p>
        </section>
      </div>{!preview && <CallBookingPanel key={`${profile.alias}:${wallet}`} alias={profile.alias} />}<footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-current/10 py-6 text-xs opacity-70"><p>{t(SITE_MOTTO)}</p><Link href="/dashboard/card" className="inline-flex items-center gap-1">{t("Create your space on Vynx")}<Link2 size={12} /></Link></footer>
    </div>
  </main>;
}
