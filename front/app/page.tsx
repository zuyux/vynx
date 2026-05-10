
"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { useModal, usePhantom, useAccounts, useDisconnect, useSolana } from "@phantom/react-sdk";

export default function Home() {
  const { open } = useModal();
  const { isConnected, isLoading } = usePhantom();
  const addresses = useAccounts();
  const { disconnect } = useDisconnect();
  const { solana } = useSolana();

  const creators = useMemo(() => [
    {
      username: "LunaSol",
      title: "Model • Content Creator",
      followers: "43.2K",
      views: "1.2M+",
      earned: "$57,340",
      img: "/asset-lunasol.png",
    },
    {
      username: "CryptoCoach",
      title: "Coach • Educator",
      followers: "21k",
      views: "800K+",
      earned: "$8,920",
      img: "/asset-cryptocoach.png",
    },
    {
      username: "ArtByMaria",
      title: "Digital Artist",
      followers: "15k",
      views: "500K+",
      earned: "$5,210",
      img: "/asset-artbymaria.png",
    },
    {
      username: "FitnessRox",
      title: "Trainer",
      followers: "12k",
      views: "300K+",
      earned: "$6,340",
      img: "/asset-fitnessrox.png",
    },
  ], []);


  // Redirect to dashboard if just connected
  if (typeof window !== "undefined" && isConnected) {
    window.location.replace("/dashboard");
    return null;
  }
  if (isLoading) return <p>Loading...</p>;

  return (
    <div className="min-h-screen bg-linear-to-br from-[#3b0149] to-[#000] text-white font-sans">
      {/* Navbar */}
      <nav className="absolute flex items-center justify-between px-8 py-6 w-full mx-auto z-30">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="VYNX Logo" width={40} height={40} />
        </div>
        <div className="hidden md:flex gap-8 text-lg font-medium">
          <a href="#creators" className="hover:text-[#6B4EFF] transition">Creators</a>
          <a href="#fans" className="hover:text-[#6B4EFF] transition">Fans</a>
          <a href="#features" className="hover:text-[#6B4EFF] transition">Pricing</a>
          <a href="#examples" className="hover:text-[#6B4EFF] transition">Reviews</a>
        </div>
        <div className="flex gap-2 items-center">
          {!isConnected ? (
            <Button className="bg-transparent text-white border border-white/20 rounded-md px-6 py-5 font-semibold shadow-lg cursor-pointer text-sm" onClick={open}>
              CONNECT
            </Button>
          ) : (
            <div className="flex gap-2 items-center">
              <span className="text-xs md:text-base">{addresses?.[0]?.address}</span>
              <Button variant="outline" onClick={() => disconnect()} className="text-xs md:text-base">Disconnect</Button>
              <Button variant="outline" onClick={() => solana.signMessage("Hello!")} className="text-xs md:text-base">Sign Message</Button>
            </div>
          )}
          <Button className="cursor-pointer bg-[#00F5A0] text-[#000000] rounded-md px-6 py-5 font-semibold hover:bg-[#6B4EFF] transition text-sm">GET CARD</Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative flex flex-col md:flex-row items-center justify-between gap-12 py-30 px-8 w-full h-auto">
        {/* Background image */}
        <Image
          src="/hero-bg.png"
          alt=""
          fill
          priority
          className="object-cover object-center z-0 opacity-20"
        />
        {/* Left: Titles and CTA */}
        <div className="flex-1 flex flex-col items-start justify-center text-left pl-36 z-1">
          <span className="uppercase tracking-widest text-sm font-semibold mb-4 text-[#A259FF]">The Creator Card of the New Era</span>
          <h1 className="heading-font text-3xl md:text-5xl font-black leading-px-6">
            YOUR SPACE.<br />
            YOUR AUDIENCE.<br />
            <span className="bg-gradient-to-r from-[#00F5A0] to-[#6B4EFF] bg-clip-text text-transparent">YOUR RULES.</span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-200 mt-4 mb-8 max-w-lg">
            Sell subscriptions, appointments, video calls, and digital content directly, instantly, and with low fees.
          </p>
          <form
            className="flex flex-col sm:flex-row gap-2 mb-8 w-full"
            onSubmit={e => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const alias = (form.elements.namedItem('alias') as HTMLInputElement)?.value.trim();
              if (alias) {
                window.location.href = `/auth/callback?page=signup&alias=${encodeURIComponent(alias)}`;
              }
            }}
          >
            <input
              type="text"
              name="alias"
              required
              minLength={3}
              maxLength={32}
              placeholder="Claim your @alias"
              className="flex-1 rounded-md px-6 py-4 text-lg font-semibold shadow-xl border border-white/20 focus:border-white/50 focus:ring-0 outline-none text-white bg-blur placeholder-zinc-400 transition"
              autoComplete="off"
            />
            <Button
              type="submit"
              className="cursor-pointer h-16 bg-[#00F5A0] hover:bg-[#ffffff] px-6 py-4 text-black font-bold rounded-md text-sm shadow-xl transition"
            >
              GET IT
            </Button>
          </form>
          <div className="flex flex-wrap gap-6 items-center text-zinc-300 text-base mt-4">
            <span className="flex items-center gap-2"><Image src="/people.svg" alt="Creators" width={20} height={20} /> 2,400 Active Creators</span>
            <span className="flex items-center gap-2"><Image src="/wallet-money.svg" alt="Earnings" width={20} height={20} /> 180k+ USDC Paid this month</span>
            <span className="flex items-center gap-2"><Image src="/solana-sol.svg" alt="Solana" width={20} height={20} /> Powered by Solana</span>
          </div>
        </div>
        {/* Right: Hero Card Image */}
        <div className="flex-1 flex items-center justify-center w-full z-10">
          <Image
            src="/hero-card-asset.png"
            alt="Creator Card Preview"
            width={420}
            height={520}
            priority
            style={{ height: "auto" }}
          />
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 max-w-5xl mx-auto" id="features">
        <motion.h2 className="heading-font text-3xl md:text-4xl font-bold mb-12 text-center" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>Have your store ready in 3 minutes</motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            { title: "Create your account", desc: "With your Solana wallet", icon: "/personalcard.svg" },
            { title: "Customize your Card", desc: "Photos, bio, colors, sections", icon: "/brush.svg" },
            { title: "Add what you sell", desc: "Subscriptions, video calls, packs", icon: "/gift.svg" },
            { title: "Share your link", desc: "On X, Instagram, TikTok...", icon: "/send.svg" },
          ].map((step, i) => (
            <motion.div key={i} className="flex flex-col text-center items-center bg-[#121212]/80 rounded-2xl p-8 shadow-lg backdrop-blur-md"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              {step.icon.startsWith("/") ? (
                <Image src={step.icon} alt={step.title} width={40} height={40} className="mb-4" />
              ) : (
                <span className="text-4xl mb-4">{step.icon}</span>
              )}
              <h3 className="heading-font text-xl mt-4 font-semibold mb-2 text-[#6B4EFF]">{step.title}</h3>
              <p className="text-zinc-300 text-center">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Creator Cards Examples */}
      <section className="py-20 px-4 max-w-full mx-auto" id="examples">
        <motion.h2 className="heading-font text-3xl md:text-4xl font-bold mb-12 text-center" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>Creator Cards already earning income</motion.h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          {creators.map((c, i) => (
            <motion.div
              key={c.username}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-white hover:scale-105 transition-transform cursor-pointer"
            >
              <Card className="rounded-2xl bg-transparent shadow-xl p-0 flex flex-col items-center overflow-hidden">
                <CardContent className="flex flex-col items-center p-0 w-full">
                  <div className="relative w-full aspect-3/4">
                    <Image src={c.img} alt={c.username} fill className="object-cover" />
                  </div>
                  <div className="flex flex-col items-center px-4 pb-4 pt-3 w-full">
                  <h3 className="heading-font text-xl text-white font-bold mb-1">@{c.username}</h3>
                  <p className="text-zinc-300 mb-2 text-center">{c.title}</p>
                  <div className="flex gap-3 text-sm text-zinc-400 mb-2">
                    <span className="flex items-center gap-1"><Image src="/people.svg" alt="followers" width={14} height={14} /> {c.followers}</span>
                    <span>•</span>
                    <span><Image src="/eye.svg" height={10} width={10} alt="" /> {c.views}</span>
                  </div>
                  <span className="text-[#00F5A0] font-bold text-lg">{c.earned}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 max-w-6xl mx-auto" id="features">
        <motion.h2 className="heading-font text-3xl md:text-4xl font-bold mb-12 text-center" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>Everything you need in one page</motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: "/flash.svg", title: "Instant Payments", desc: "Get paid in USDC or SOL instantly to your wallet." },
            { icon: "/heart-add.svg", title: "Subscriptions", desc: "Recurring payments with Streamflow." },
            { icon: "/gift.svg", title: "Digital Store", desc: "Sell packs, videos, PDFs, etc. Automatic delivery." },
            { icon: "/send-2.svg", title: "Viral Blinks", desc: "Every button generates a Blink to share on X." },
            { icon: "/verify.svg", title: "Gated Access", desc: "NFTs or on-chain verification for private content." },
            { icon: "/wallet-money.svg", title: "Tips", desc: "Receive instant tips from your fans." },
          ].map((f, i) => (
            <motion.div key={f.title} className="flex flex-col items-center bg-[#121212]/80 rounded-2xl p-8 shadow-lg backdrop-blur-md"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Image src={f.icon} alt={f.title} width={40} height={40} className="mb-4" />
              <h3 className="heading-font text-xl font-semibold mb-2 text-[#00F5A0]">{f.title}</h3>
              <p className="text-zinc-300 text-center">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer / Trust signals */}
      <footer className="py-12 px-4 text-center text-zinc-400 text-sm">
        <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-4">
          <span>© {new Date().getFullYear()} VYNX</span>
          <span className="hidden md:inline">|</span>
          <span>Your space. Your audience. Your rules.</span>
          <span className="hidden md:inline">|</span>
          <span>Built on <span className="text-[#00F5A0] font-bold">Solana</span></span>
        </div>
        <div>
          <a href="https://github.com/zuyux/vynx" target="_blank" rel="noopener noreferrer" className="hover:text-[#6B4EFF]">GitHub</a>
        </div>
      </footer>
    </div>
  );
}