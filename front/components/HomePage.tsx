"use client";
import { SITE_MOTTO } from '@/lib/brand';
import { userErrorMessage, responseError } from '@/lib/user-facing-error';

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

import { useWalletSession } from "@/components/WalletSessionProvider";
import { Button } from "@/components/ui/button";
import { PublicCreatorCard } from "@/components/PublicCreatorCard";
import demoProfiles from "@/data/demo-profiles.json";
import { EMPTY_DRAFT, type CreatorDraft } from "@/lib/creator-draft";
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

export default function HomePage({ children, featuredCreator }: { children?: ReactNode; featuredCreator?: PublicCreator | null }) {
  const router = useRouter();
  const session = useWalletSession();
  const reduceMotion = useReducedMotion();
  const reveal = reduceMotion ? { initial: false as const } : sectionReveal;
  const isLoading = session.checking;
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState('');
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
          if (profile?.wallet_address === wallet) router.replace(`/${encodeURIComponent(profile.username)}`);
        }
      })
      .catch(() => {
        // Keep the claim action available if profile lookup is unavailable.
      });
    return () => controller.abort();
  }, [wallet, router]);

  const handleSignIn = async (alias?: string) => {
    setIsDisconnecting(true); setDisconnectError('');
    try {
      await (sessionConnected ? session.ensureSession() : session.authenticate());
      if (alias) {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw responseError(response, result, 'Unable to complete the request. Please retry.');
        router.push(result.alias ? `/${encodeURIComponent(result.alias)}` : `/profile/buy-alias?${new URLSearchParams({ alias, next: '/dashboard/card', welcome: '1' })}`);
        router.refresh();
      }
    } catch (reason) { setDisconnectError(userErrorMessage(reason, 'Unable to sign in. Retry.')); }
    finally { setIsDisconnecting(false); }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true); setDisconnectError('');
    try {
      await session.logout();
    } catch (reason) { setDisconnectError(userErrorMessage(reason, 'Unable to disconnect.')); }
    finally { setIsDisconnecting(false); }
  };

  const focusAlias = () => {
    const aliasInput = document.getElementById("alias");
    aliasInput?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    aliasInput?.focus({ preventScroll: true });
  };

  return (
    <main id="main-content" tabIndex={-1} className="landing-page min-h-screen overflow-hidden bg-[#080808] text-white selection:bg-[#f5f5f5] selection:text-black">
      <nav className="absolute inset-x-0 top-0 z-40 px-5 py-5 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 backdrop-blur-xl sm:px-6">
          <a href="#top" aria-label="VYNX home" className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            <Image src="/logo-white.svg" alt="" width={36} height={28} priority />
          </a>
          <div className="hidden items-center gap-9 text-sm font-semibold text-white/70 md:flex">
            <Link href="/dashboard/sponsorships" className="transition-colors hover:text-white">Sponsorships</Link>
            <a href="#how-it-works" className="transition-colors hover:text-white">How it works</a>
            <a href="#creators" className="transition-colors hover:text-white">Creators</a>
            <a href="#features" className="transition-colors hover:text-white">Features</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <Button
                onClick={sessionConnected ? handleDisconnect : () => void handleSignIn()}
                disabled={isLoading || isDisconnecting}
                aria-label={sessionConnected ? "Disconnect wallet" : "Connect wallet"}
                className="h-10 rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-bold tracking-wide text-white hover:bg-white/10 sm:px-6"
              >
                {isDisconnecting ? (sessionConnected ? "DISCONNECTING…" : "SIGNING IN…") : sessionConnected ? "DISCONNECT" : "CONNECT"}
              </Button>
              {disconnectError && <p role="alert" className="absolute right-0 top-full mt-2 w-56 rounded-lg bg-black/90 p-3 text-xs text-red-300">{disconnectError}</p>}
            </div>
            <Button onClick={hasCard && card ? () => router.push(`/${encodeURIComponent(card.alias)}`) : focusAlias} className="h-10 rounded-xl bg-[#f5f5f5] px-4 text-xs font-black tracking-wide text-black shadow-[0_0_30px_rgba(255,255,255,0.06)] hover:bg-neutral-200 sm:px-6">{hasCard ? "MY CARD" : "GET CARD"}</Button>
          </div>
        </div>
      </nav>

      <section id="top" className="relative flex min-h-[100svh] items-center overflow-hidden px-5 pb-14 pt-32 sm:px-8 lg:px-12 lg:pb-8 lg:pt-28">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_45%,rgba(255,255,255,0.055),transparent_55%)]" />

        <div className="relative z-10 mx-auto grid w-full max-w-[1480px] items-center gap-12 lg:grid-cols-[1.04fr_0.96fr] xl:gap-20">
          <motion.div initial={reduceMotion ? false : { opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }} className="max-w-4xl">
            <div className="mb-6 flex items-center gap-3 text-xs font-black uppercase tracking-[0.28em] text-[#a3a3a3] sm:text-sm"><span className="h-px w-10 bg-[#a3a3a3]" />THE CARD FOR THE CREATORS ECONOMY</div>
            <h1 className="heading-font text-[clamp(1.65rem,5.2vw,6rem)] font-black leading-[1.05] tracking-[-0.055em]">
              <span className="block whitespace-nowrap">YOUR SPACE.</span>
              <span className="block whitespace-nowrap">YOUR AUDIENCE.</span>
              <span className="block whitespace-nowrap text-neutral-400">YOUR RULES.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/70 sm:text-xl lg:text-2xl">Turn your audience into a business. Sell access, time and digital products directly—with no platform in the middle.</p>

            <form className="mt-9 flex max-w-2xl flex-col gap-3 rounded-2xl border border-white/15 bg-black/35 p-2 backdrop-blur-xl sm:flex-row" onSubmit={(event) => {
              event.preventDefault();
              const alias = (event.currentTarget.elements.namedItem("alias") as HTMLInputElement)?.value.trim();
              if (alias) void handleSignIn(alias);
            }}>
              <div className="flex min-w-0 flex-1 items-center px-4"><span className="mr-2 text-xl font-bold text-white/30">@</span><input id="alias" name="alias" type="text" required minLength={1} maxLength={30} placeholder="youralias" autoComplete="off" aria-label="Claim your alias" className="h-14 min-w-0 flex-1 rounded-md bg-transparent text-lg font-medium text-white outline-none placeholder:text-white/60" /></div>
              <Button type="submit" className="h-14 rounded-xl bg-[#f5f5f5] px-8 text-sm font-black tracking-wide text-black transition hover:scale-[1.02] hover:bg-neutral-200">CLAIM YOUR CARD →</Button>
            </form>
            <div className="mt-7 flex flex-wrap gap-x-7 gap-y-3 text-sm font-medium text-white/55 sm:text-base">
              <span className="flex items-center gap-2"><Image src="/people.svg" alt="" width={18} height={18} /> 2,400 creators</span>
              <span className="flex items-center gap-2"><Image src="/wallet-money.svg" alt="" width={18} height={18} /> 180k+ USDC paid</span>
              <span className="flex items-center gap-2"><Image src="/solana-sol.svg" alt="" width={18} height={18} /> Powered by Solana</span>
            </div>
          </motion.div>

          <motion.div className="relative mx-auto w-full max-w-[620px] lg:justify-self-end" initial={reduceMotion ? false : { opacity: 0, scale: 0.86, rotate: 3 }} animate={reduceMotion ? { opacity: 1, scale: 1, rotate: 0, y: 0 } : { opacity: 1, scale: 1, rotate: 0, y: [0, -14, 0] }} transition={{ opacity: { duration: 0.8 }, scale: { duration: 0.8 }, rotate: { duration: 0.8 }, y: { duration: 5, repeat: Infinity, ease: "easeInOut" } }} whileHover={reduceMotion ? undefined : { scale: 1.025, rotate: -1.5 }}>
            <div className="absolute inset-[8%] rounded-[4rem] bg-white/5 blur-[80px]" />
            <motion.div aria-hidden="true" className="absolute -left-2 top-[19%] z-20 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-xs font-bold text-white/80 shadow-xl backdrop-blur-xl sm:left-2 sm:text-sm" animate={reduceMotion ? { x: 0 } : { x: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>⚡ Paid instantly</motion.div>
            <Image src="/hero-card-asset.png" alt="VYNX creator card preview" width={620} height={768} priority className="relative z-10 mx-auto h-auto max-h-[calc(100svh-10rem)] w-auto max-w-full drop-shadow-[0_35px_70px_rgba(0,0,0,0.55)]" />
          </motion.div>
        </div>
      </section>

      <section id="how-it-works" className="px-5 py-24 sm:px-8 lg:px-12 lg:py-32"><div className="mx-auto max-w-[1480px]">
        <motion.div {...reveal} transition={{ duration: 0.6 }} className="mb-14 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-[#f5f5f5]">Zero friction</p><h2 className="heading-font max-w-4xl text-4xl leading-[0.95] sm:text-6xl lg:text-7xl">LIVE IN THREE MINUTES.</h2></div><p className="max-w-md text-lg leading-relaxed text-white/55">From wallet to storefront in four simple moves. No code, no gatekeepers.</p></motion.div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{steps.map((step, index) => <motion.article key={step.title} initial={reduceMotion ? false : { opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5, delay: index * 0.08 }} whileHover={reduceMotion ? undefined : { y: -8 }} className="group relative min-h-72 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] p-7 transition-colors hover:border-[#d4d4d4]/60 hover:bg-[#d4d4d4]/10"><span className="absolute right-5 top-3 heading-font text-7xl text-white/45 transition-colors group-hover:text-white/60">{step.number}</span><div className="mb-14 flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 transition-transform motion-safe:group-hover:rotate-6 motion-safe:group-hover:scale-110"><Image src={step.icon} alt="" width={28} height={28} /></div><h3 className="heading-font text-2xl leading-tight">{step.title}</h3><p className="mt-3 text-base leading-relaxed text-white/60">{step.desc}</p></motion.article>)}</div>
      </div></section>

      <section id="creators" className="border-y border-white/8 bg-white/[0.018] px-5 py-24 sm:px-8 lg:px-12 lg:py-32"><div className="mx-auto max-w-[1480px]">
        <motion.div {...reveal} transition={{ duration: 0.6 }} className="mb-14 text-center">
          <p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-[#a3a3a3]">Made for every creator</p>
          <h2 className="heading-font text-4xl leading-[0.95] sm:text-6xl lg:text-7xl">MEET YOUR NEXT CARD.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-white/60">Your space for ideas, stories, and everything you create.</p>
        </motion.div>
        <div className="grid items-start gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {featuredCreator && <article aria-label="@fabohax creator card">
            <p className="mb-3 px-3 text-sm text-white/70">Creator · Developer</p>
            <PublicCreatorCard preview embedded creator={featuredCreator} />
          </article>}
          {demoProfiles.slice(0, featuredCreator ? 3 : 4).map((profile, index) => <motion.article key={profile.id} aria-label={`${profile.name} creator card`} initial={reduceMotion ? false : { opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.5, delay: index * 0.08 }}>
            <div className="mb-3 flex items-center justify-between gap-3 px-3">
              <p className="text-sm text-white/70">{profile.role}</p>
            </div>
            <PublicCreatorCard preview embedded creator={{
              id: profile.id, alias: profile.alias.replace(/^demo_/, ''), wallet: profile.wallet, tipsEnabled: false, published: false,
              design: { ...EMPTY_DRAFT, alias: profile.alias.replace(/^demo_/, ''), name: profile.name, bio: profile.bio.replace(/ Fictional demo profile\.$/, ''),
                avatar: `/demo/creators/${profile.image}`, accent: profile.accent as CreatorDraft['accent'], socials: profile.socials },
            }} />
          </motion.article>)}
        </div>
        <div className="mt-8 text-center"><Link href="/fabohax" className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-5 text-sm font-semibold transition hover:bg-white/5">Explore @fabohax →</Link></div>
      </div></section>

      <section id="features" className="px-5 py-24 sm:px-8 lg:px-12 lg:py-32"><div className="mx-auto max-w-[1480px]">
        <motion.div {...reveal} transition={{ duration: 0.6 }} className="mb-14 max-w-5xl"><p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-[#f5f5f5]">One link. Every revenue stream.</p><h2 className="heading-font text-4xl leading-[0.95] sm:text-6xl lg:text-7xl">EVERYTHING YOU SELL, IN ONE PLACE.</h2></motion.div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{features.map((feature, index) => <motion.article key={feature.title} initial={reduceMotion ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.45, delay: index * 0.06 }} whileHover={reduceMotion ? undefined : { scale: 1.015 }} className="group flex min-h-56 flex-col justify-between rounded-3xl border border-white/10 bg-linear-to-br from-white/[0.055] to-transparent p-7 transition-colors hover:border-[#f5f5f5]/35"><div className="flex size-12 items-center justify-center rounded-xl bg-white/5 transition-colors group-hover:bg-[#f5f5f5]/10"><Image src={feature.icon} alt="" width={27} height={27} /></div><div><h3 className="heading-font text-2xl">{feature.title}</h3><p className="mt-2 max-w-sm leading-relaxed text-white/60">{feature.desc}</p></div></motion.article>)}</div>
      </div></section>

      <section className="px-5 pb-8 sm:px-8 lg:px-12"><motion.div {...reveal} transition={{ duration: 0.6 }} className="relative mx-auto max-w-[1480px] overflow-hidden rounded-[2rem] border border-white/10 bg-linear-to-r from-[#181818] to-[#0c0c0c] px-7 py-16 text-center sm:px-12 lg:py-24"><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.04),transparent_45%)]" /><div className="relative"><p className="mb-4 text-sm font-black uppercase tracking-[0.25em] text-[#f5f5f5]">Your audience is waiting</p><h2 className="heading-font mx-auto max-w-5xl text-5xl leading-[0.9] sm:text-7xl lg:text-8xl">OWN YOUR NEXT MOVE.</h2><Button onClick={focusAlias} className="mt-9 h-14 rounded-xl bg-[#f5f5f5] px-9 text-sm font-black tracking-wide text-black motion-safe:hover:scale-105 hover:bg-neutral-200">CLAIM YOUR CARD →</Button></div></motion.div></section>

      {children}
      <footer className="px-5 py-10 text-sm text-white/60 sm:px-8 lg:px-12"><div className="mx-auto flex max-w-[1480px] flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row"><span>© {new Date().getFullYear()} VYNX — {SITE_MOTTO}</span><a href="https://github.com/zuyux/vynx" target="_blank" rel="noopener noreferrer" className="font-bold transition-colors hover:text-[#f5f5f5]">GitHub ↗</a></div></footer>
    </main>
  );
}
