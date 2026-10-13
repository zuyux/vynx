"use client";
import { useCopy } from "@/i18n/copy";

import { SITE_MOTTO } from '@/lib/brand';
import { userErrorMessage, responseError } from '@/lib/user-facing-error';

import Image from "next/image";
import Link from '@/i18n/link';
import { UserRound } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from '@/i18n/navigation';
import { motion, useReducedMotion } from "framer-motion";

import { useWalletSession } from "@/components/WalletSessionProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import PointerTilt from "@/components/PointerTilt";
import { PublicCreatorCard } from "@/components/PublicCreatorCard";
import type { PublicCreator } from "@/lib/public-creator";

const steps = [
  { number: "01", title: "Create your account", desc: "Sign in with email or your Solana wallet", icon: "/personalcard.svg" },
  { number: "02", title: "Customize your card", desc: "Photos, bio, colors and sections", icon: "/brush.svg" },
  { number: "03", title: "Add what you sell", desc: "Subscriptions, calls and packs", icon: "/gift.svg" },
  { number: "04", title: "Share your link", desc: "Publish on X, Instagram and TikTok", icon: "/send.svg" },
];

const features = [
  { icon: "/flash.svg", title: "Instant Payments", desc: "Get paid in USDC or SOL directly to your wallet." },
  { icon: "/heart-add.svg", title: "Subscriptions", desc: "Turn your audience into predictable recurring revenue." },
  { icon: "/gift.svg", title: "Digital Store", desc: "Sell packs, videos, PDFs and courses with automatic delivery." },
  { icon: "/send-2.svg", title: "Viral Blinks", desc: "Turn every offer into a shareable Solana Blink." },
  { icon: "/verify.svg", title: "Gated Access", desc: "Unlock private content with NFTs or on-chain verification." },
  { icon: "/wallet-money.svg", title: "Tips", desc: "Let your biggest fans support you in one click." },
];

const sectionReveal = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
};

export default function HomePage({ children, featuredCreators = [] }: { children?: ReactNode; featuredCreators?: PublicCreator[] }) {
  const t = useCopy();
  const router = useRouter();
  const session = useWalletSession();
  const reduceMotion = useReducedMotion();
  const reveal = reduceMotion ? { initial: false as const } : sectionReveal;
  const isLoading = session.checking;
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [aliasModalOpen, setAliasModalOpen] = useState(false);
  const [claimAlias, setClaimAlias] = useState('');
  const showcaseVideo = useRef<HTMLVideoElement>(null);
  const [isShowcasePlaying, setIsShowcasePlaying] = useState(false);
  const [showcaseError, setShowcaseError] = useState('');

  const toggleShowcase = async () => {
    const video = showcaseVideo.current;
    if (!video) return;
    setShowcaseError('');
    if (!video.paused) {
      video.pause();
      return;
    }
    try {
      await video.play();
    } catch {
      setShowcaseError(t('Unable to play the video. Please try again.'));
    }
  };
  const signedIn = !!session.wallet;
  const sessionConnected = !!session.wallet && session.wallet === session.connectedWallet;
  const wallet = sessionConnected ? session.wallet : '';
  const [card, setCard] = useState<{ wallet: string; alias: string } | null>(null);
  const hasCard = !!wallet && card?.wallet === wallet;

  useEffect(() => {
    if (!wallet) return;
    const controller = new AbortController();
    fetch(`/api/profile?${new URLSearchParams({ wallet })}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async response => {
        if (!response.ok) return;
        const { profile } = await response.json();
        if (!controller.signal.aborted) {
          setCard(profile?.wallet_address === wallet ? { wallet, alias: profile.username } : null);
        }
      })
      .catch(() => {
        // Keep the claim action available if profile lookup is unavailable.
      });
    return () => controller.abort();
  }, [wallet]);

  const handleSignIn = async (alias?: string) => {
    setIsSigningIn(true); setSignInError('');
    try {
      await (signedIn ? session.ensureSession() : session.authenticate());
      if (alias) {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw responseError(response, result, t('Unable to complete the request. Please retry.'));
        router.push(result.alias ? '/dashboard/card' : `/profile/buy-alias?${new URLSearchParams({ alias, next: '/dashboard/card', welcome: '1' })}`);
        router.refresh();
      }
    } catch (reason) { setSignInError(userErrorMessage(reason, t('Unable to sign in. Retry.'))); }
    finally { setIsSigningIn(false); }
  };

  const openAliasModal = () => {
    const aliasInput = document.getElementById("alias") as HTMLInputElement | null;
    setClaimAlias(aliasInput?.value.trim() ?? '');
    setSignInError('');
    setAliasModalOpen(true);
  };

  return (
    <main id="main-content" tabIndex={-1} className="landing-page min-h-screen overflow-clip bg-[#080808] text-white selection:bg-[#f5f5f5] selection:text-black">
      <nav className="absolute inset-x-0 top-0 z-40 px-5 py-5 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 backdrop-blur-xl sm:px-6">
          <a href="#top" aria-label={t("VYNX home")} className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            <Image src="/logo-white.svg" alt="" width={36} height={28} priority />
          </a>
          <div className="hidden items-center gap-9 text-sm font-semibold text-white/70 md:flex">
            <Link href="/dashboard/sponsorships" className="transition-colors hover:text-white">{t("Sponsorships")}</Link>
            <a href="#how-it-works" className="transition-colors hover:text-white">{t("How it works")}</a>
            <a href="#creators" className="transition-colors hover:text-white">{t("Creators")}</a>
            <a href="#features" className="transition-colors hover:text-white">{t("Features")}</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative">
              {signedIn ? <Link href="/dashboard/card" aria-label={t("Profile")} title={t("Profile")} className="inline-flex size-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"><UserRound size={20} aria-hidden="true" /></Link> : <Button
                onClick={() => void handleSignIn()}
                disabled={isLoading || isSigningIn}
                aria-label={isLoading ? t("Checking session") : t("Connect wallet")}
                className="h-10 rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-bold tracking-wide text-white hover:bg-white/10 sm:px-6"
              >
                {isLoading ? t("CHECKING…") : isSigningIn ? t("SIGNING IN…") : t("CONNECT")}
              </Button>}
              {signInError && <p role="alert" className="absolute right-0 top-full mt-2 w-56 rounded-lg bg-black/90 p-3 text-xs text-red-300">{t(signInError)}</p>}
            </div>
            <Button onClick={hasCard && card ? () => router.push(`/${encodeURIComponent(card.alias)}`) : openAliasModal} className="h-10 rounded-xl bg-[#f5f5f5] px-4 text-xs font-black tracking-wide text-black shadow-[0_0_30px_rgba(255,255,255,0.06)] hover:bg-neutral-200 sm:px-6">{hasCard ? t("MY CARD") : t("GET CARD")}</Button>
          </div>
        </div>
      </nav>

      <section id="top" className="relative flex min-h-[100svh] items-center overflow-hidden px-5 pb-14 pt-32 sm:px-8 lg:px-12 lg:pb-8 lg:pt-28">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_45%,rgba(255,255,255,0.055),transparent_55%)]" />

        <div className="relative z-10 mx-auto grid w-full max-w-[1480px] grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] xl:gap-20">
          <motion.div initial={reduceMotion ? false : { opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }} className="min-w-0 max-w-4xl">
            <div className="mb-6 flex items-center gap-3 text-xs font-black uppercase tracking-[0.28em] text-[#a3a3a3] sm:text-sm"><span className="h-px w-10 bg-[#a3a3a3]" />{t("THE CARD FOR THE CREATORS ECONOMY")}</div>
            <h1 className="heading-font text-[clamp(1.65rem,5.2vw,6rem)] font-black leading-[1.05] tracking-[-0.055em]">
              <span className="block whitespace-nowrap">{t("YOUR SPACE.")}</span>
              <span className="block whitespace-nowrap">{t("YOUR AUDIENCE.")}</span>
              <span className="block whitespace-nowrap text-neutral-400">{t("YOUR RULES.")}</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/70 sm:text-xl lg:text-2xl">{t("Turn your audience into a business. Sell access, time and digital products directly—with no platform in the middle.")}</p>

            <form className="mt-9 flex max-w-2xl flex-col gap-3 rounded-2xl border border-white/15 bg-black/35 p-2 backdrop-blur-xl sm:flex-row" onSubmit={(event) => {
              event.preventDefault();
              const alias = (event.currentTarget.elements.namedItem("alias") as HTMLInputElement)?.value.trim();
              setClaimAlias(alias || '');
              setSignInError('');
              setAliasModalOpen(true);
            }}>
              <div className="flex min-w-0 flex-1 items-center px-4"><span className="mr-2 text-xl font-bold text-white/30">@</span><input id="alias" name="alias" type="text" required minLength={1} maxLength={30} placeholder="youralias" autoComplete="off" aria-label={t("Claim your alias")} className="h-14 min-w-0 flex-1 rounded-md bg-transparent text-lg font-medium text-white outline-none placeholder:text-white/60" /></div>
              <Button type="submit" className="h-14 rounded-xl bg-[#f5f5f5] px-8 text-sm font-black tracking-wide text-black transition hover:scale-[1.02] hover:bg-neutral-200">{t("CLAIM YOUR CARD →")}</Button>
            </form>
            <div className="mt-7 flex flex-wrap gap-x-7 gap-y-3 text-sm font-medium text-white/55 sm:text-base">
              <span className="flex items-center gap-2"><Image src="/people.svg" alt="" width={18} height={18} />{t(" 2,400 creators")}</span>
              <span className="flex items-center gap-2"><Image src="/wallet-money.svg" alt="" width={18} height={18} />{t(" 180k+ USDC paid")}</span>
              <span className="flex items-center gap-2"><Image src="/solana-sol.svg" alt="" width={18} height={18} />{t(" Powered by Solana")}</span>
            </div>
          </motion.div>

          <motion.div className="relative mx-auto w-full max-w-[620px] lg:justify-self-end" initial={reduceMotion ? false : { opacity: 0, scale: 0.86, rotate: 3 }} animate={reduceMotion ? { opacity: 1, scale: 1, rotate: 0, y: 0 } : { opacity: 1, scale: 1, rotate: 0, y: [0, -14, 0] }} transition={{ opacity: { duration: 0.8 }, scale: { duration: 0.8 }, rotate: { duration: 0.8 }, y: { duration: 5, repeat: Infinity, ease: "easeInOut" } }} whileHover={reduceMotion ? undefined : { scale: 1.025, rotate: -1.5 }}>
            <PointerTilt>
            <div className="absolute inset-[8%] rounded-[4rem] bg-white/5 blur-[80px]" />
            <motion.div aria-hidden="true" className="absolute -left-2 top-[19%] z-20 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-xs font-bold text-white/80 shadow-xl backdrop-blur-xl sm:left-2 sm:text-sm" animate={reduceMotion ? { x: 0 } : { x: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>{t("⚡ Paid instantly")}</motion.div>
            <Image src="/hero-card-asset.png" alt={t("VYNX creator card preview")} width={620} height={768} priority className="relative z-10 mx-auto h-auto max-h-[calc(100svh-10rem)] w-auto max-w-full drop-shadow-[0_35px_70px_rgba(0,0,0,0.55)]" />
            </PointerTilt>
          </motion.div>
        </div>
      </section>

      <section id="how-it-works" className="px-5 py-24 sm:px-8 lg:px-12 lg:py-32"><div className="mx-auto max-w-[1480px]">
        <motion.div {...reveal} transition={{ duration: 0.6 }} className="mb-14 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-[#f5f5f5]">{t("Zero friction")}</p><h2 className="heading-font max-w-4xl text-4xl leading-[0.95] sm:text-6xl lg:text-7xl">{t("LIVE IN THREE MINUTES.")}</h2></div><p className="max-w-md text-lg leading-relaxed text-white/55">{t("From wallet to storefront in four simple moves. No code, no gatekeepers.")}</p></motion.div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{steps.map((step, index) => <motion.article key={step.title} initial={reduceMotion ? false : { opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5, delay: index * 0.08 }} whileHover={reduceMotion ? undefined : { y: -8 }} className="group relative min-h-72 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] p-7 transition-colors hover:border-[#d4d4d4]/60 hover:bg-[#d4d4d4]/10"><span className="absolute right-5 top-3 heading-font text-7xl text-white/45 transition-colors group-hover:text-white/60">{step.number}</span><div className="mb-14 flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 transition-transform motion-safe:group-hover:rotate-6 motion-safe:group-hover:scale-110"><Image src={step.icon} alt="" width={28} height={28} /></div><h3 className="heading-font text-2xl leading-tight">{t(step.title)}</h3><p className="mt-3 text-base leading-relaxed text-white/60">{t(step.desc)}</p></motion.article>)}</div>
      </div></section>

      <section id="creators" className="border-y border-white/8 bg-white/[0.018] px-5 py-24 sm:px-8 lg:px-12 lg:py-32"><div className="mx-auto max-w-[1480px]">
        <motion.div {...reveal} transition={{ duration: 0.6 }} className="mb-14 text-center">
          <p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-[#a3a3a3]">{t("Made for every creator")}</p>
          <h2 className="heading-font text-4xl leading-[0.95] sm:text-6xl lg:text-7xl">{t("MEET YOUR NEXT CARD.")}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-white/60">{t("Your space for ideas, stories, and everything you create.")}</p>
        </motion.div>
        <div className="grid items-start gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {featuredCreators.map((creator, index) => <motion.article key={creator.alias} aria-label={`@${creator.alias} creator card`} initial={reduceMotion ? false : { opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.5, delay: index * 0.08 }}>
            <PointerTilt className="relative">
              <div className="relative">
              <PublicCreatorCard preview embedded showDetails={false} creator={creator} />
              <Link href={`/${creator.alias}`} aria-label={`View @${creator.alias} card`} className="absolute inset-0 z-20 rounded-[2rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400" />
              </div>
            </PointerTilt>
          </motion.article>)}
        </div>
      </div></section>

      <section id="features" className="px-5 py-24 sm:px-8 lg:px-12 lg:py-32"><div className="mx-auto max-w-[1480px]">
        <motion.div {...reveal} transition={{ duration: 0.6 }} className="mb-14 max-w-5xl"><p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-[#f5f5f5]">{t("One link. Every revenue stream.")}</p><h2 className="heading-font text-4xl leading-[0.95] sm:text-6xl lg:text-7xl">{t("EVERYTHING YOU SELL, IN ONE PLACE.")}</h2></motion.div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{features.map((feature, index) => <motion.article key={feature.title} initial={reduceMotion ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.45, delay: index * 0.06 }} whileHover={reduceMotion ? undefined : { scale: 1.015 }} className="group flex min-h-56 flex-col justify-between rounded-3xl border border-white/10 bg-linear-to-br from-white/[0.055] to-transparent p-7 transition-colors hover:border-[#f5f5f5]/35"><div className="flex size-12 items-center justify-center rounded-xl bg-white/5 transition-colors group-hover:bg-[#f5f5f5]/10"><Image src={feature.icon} alt="" width={27} height={27} /></div><div><h3 className="heading-font text-2xl">{t(feature.title)}</h3><p className="mt-2 max-w-sm leading-relaxed text-white/60">{t(feature.desc)}</p></div></motion.article>)}</div>
      </div></section>

      <section aria-label={t("VYNX showcase")} className="px-5 pb-12 sm:px-8 lg:px-12">
        <motion.div {...reveal} transition={{ duration: 0.6 }} className="group relative mx-auto max-w-[1480px] overflow-hidden rounded-[2rem] border border-white/10 bg-black">
          <video
            ref={showcaseVideo}
            src="/vynx-showcase.mp4"
            poster="/video-showcase-preview.png"
            preload="metadata"
            playsInline
            aria-label={t("VYNX showcase video")}
            className="aspect-video w-full object-contain"
            onPlay={() => setIsShowcasePlaying(true)}
            onPause={() => setIsShowcasePlaying(false)}
            onEnded={() => setIsShowcasePlaying(false)}
            onError={() => setShowcaseError(t('Unable to load the video. Please try again.'))}
          >{t(" Your browser does not support video playback. ")}</video>
          <button
            type="button"
            onClick={() => void toggleShowcase()}
            aria-label={isShowcasePlaying ? t('Pause showcase video') : t('Play showcase video')}
            className="group/playback absolute inset-0 flex cursor-pointer items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
          >
            <span className="pointer-events-none flex size-16 items-center justify-center rounded-full border border-white/30 bg-black/50 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100 group-focus-visible/playback:opacity-100 sm:size-20">
              <Image src={isShowcasePlaying ? '/pause.svg' : '/play.svg'} alt="" width={32} height={32} />
            </span>
          </button>
          {showcaseError && <p role="alert" className="absolute inset-x-4 bottom-4 rounded-xl bg-black/80 p-3 text-center text-sm text-white">{t(showcaseError)}</p>}
        </motion.div>
      </section>

      <section className="px-5 pb-8 sm:px-8 lg:px-12"><motion.div {...reveal} transition={{ duration: 0.6 }} className="relative mx-auto max-w-[1480px] overflow-hidden rounded-[2rem] border border-white/10 bg-linear-to-r from-[#181818] to-[#0c0c0c] px-7 py-16 text-center sm:px-12 lg:py-24"><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.04),transparent_45%)]" /><div className="relative"><p className="mb-4 text-sm font-black uppercase tracking-[0.25em] text-[#f5f5f5]">{t("Your audience is waiting")}</p><h2 className="heading-font mx-auto max-w-5xl text-5xl leading-[0.9] sm:text-7xl lg:text-8xl">{t("OWN YOUR NEXT MOVE.")}</h2><Button onClick={openAliasModal} className="mt-9 h-14 rounded-xl bg-[#f5f5f5] px-9 text-sm font-black tracking-wide text-black motion-safe:hover:scale-105 hover:bg-neutral-200">{t("CLAIM YOUR CARD →")}</Button></div></motion.div></section>

      <Dialog open={aliasModalOpen} onOpenChange={setAliasModalOpen}>
        <DialogContent className="alias-claim-modal w-[calc(100%-2rem)] max-w-md rounded-3xl border-white/15 bg-[#101010] p-8 text-white outline-none">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <Image src="/personalcard.svg" alt="" width={36} height={36} />
          </div>
          <DialogTitle className="heading-font text-center text-3xl">{t("Get an Alias")}</DialogTitle>
          <DialogDescription className="text-center text-base text-white/60">{t("Choose your alias to get your VYNX creator card.")}</DialogDescription>
          <form className="grid gap-4" onSubmit={(event) => {
            event.preventDefault();
            const alias = claimAlias.trim();
            if (alias) void handleSignIn(alias);
          }}>
            <label htmlFor="claim-alias" className="text-sm font-medium text-white/80">{t("Your alias")}</label>
            <div className="flex items-center rounded-xl border border-white/15 bg-black/35 px-4">
              <span aria-hidden="true" className="mr-2 text-xl text-white/40">@</span>
              <input id="claim-alias" name="alias" value={claimAlias} onChange={(event) => setClaimAlias(event.target.value)} required minLength={1} maxLength={30} placeholder="youralias" autoComplete="off" className="h-14 min-w-0 flex-1 bg-transparent text-lg text-white outline-none placeholder:text-white/40" />
            </div>
            {signInError && <p role="alert" className="text-sm text-red-300">{t(signInError)}</p>}
            <Button type="submit" disabled={isLoading || isSigningIn} className="h-14 rounded-xl bg-white text-sm font-black tracking-wide text-black hover:bg-neutral-200 focus-visible:border-transparent focus-visible:ring-0">{isLoading ? t('CHECKING…') : isSigningIn ? t('SIGNING IN…') : t('GET AN ALIAS')}</Button>
          </form>
          <button type="button" onClick={() => setAliasModalOpen(false)} className="mx-auto rounded-md px-3 py-2 text-sm text-white/60 hover:text-white outline-none">{t("Cancel")}</button>
        </DialogContent>
      </Dialog>

      {children}
      <footer className="px-5 py-10 text-sm text-white/60 sm:px-8 lg:px-12"><div className="mx-auto flex max-w-[1480px] flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row"><span>© {new Date().getFullYear()}{t(" VYNX — ")}{t(SITE_MOTTO)}</span><div className="flex items-center gap-2"><a href="https://x.com/vynxme" target="_blank" rel="noopener noreferrer" aria-label={t("VYNX on X (opens in a new tab)")} className="inline-flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:text-[#f5f5f5] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.835L0 1.154h7.594l5.243 6.932 6.064-6.933ZM17.61 20.644h2.039L6.486 3.24H4.298L17.61 20.644Z" /></svg></a><a href="https://github.com/zuyux/vynx" target="_blank" rel="noopener noreferrer" aria-label={t("VYNX on GitHub (opens in a new tab)")} className="inline-flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:text-[#f5f5f5] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.93.43.37.83 1.1.83 2.22v3.29c0 .32.21.7.82.58A12 12 0 0 0 24 12C24 5.37 18.63 0 12 0Z" /></svg></a></div></div></footer>
    </main>
  );
}
