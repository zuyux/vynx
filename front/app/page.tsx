
"use client";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useMemo } from "react";

// Phantom wallet connect (dynamically import to avoid SSR issues)
const WalletConnectButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletConnectButton),
  { ssr: false }
);

export default function Home() {
  // Example creator cards (mock data)
  const creators = useMemo(() => [
    {
      username: "LunaSol",
      title: "Model • Content Creator",
      followers: "43.2K",
      views: "1.2M+",
      earned: "$57,340",
      img: "/mocks/vynx-card.png",
    },
    {
      username: "CryptoCoach",
      title: "Coach • Educator",
      followers: "21k",
      views: "800K+",
      earned: "$8,920",
      img: "/mocks/vynx-card.png",
    },
    {
      username: "ArtByMaria",
      title: "Digital Artist",
      followers: "15k",
      views: "500K+",
      earned: "$5,210",
      img: "/mocks/vynx-card.png",
    },
    {
      username: "FitnessSol",
      title: "Trainer",
      followers: "12k",
      views: "300K+",
      earned: "$6,340",
      img: "/mocks/vynx-card.png",
    },
  ], []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0A0A] via-[#1a003a] to-[#00F5A0]/10 text-white font-sans">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-6 w-full max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="VYNX Logo" width={40} height={40} />
        </div>
        <div className="hidden md:flex gap-8 text-lg font-medium">
          <a href="#creators" className="hover:text-[#6B4EFF] transition">Creators</a>
          <a href="#fans" className="hover:text-[#6B4EFF] transition">Fans</a>
          <a href="#features" className="hover:text-[#6B4EFF] transition">Pricing</a>
          <a href="#examples" className="hover:text-[#6B4EFF] transition">Reviews</a>
        </div>
        <div className="flex gap-4 items-center">
          <WalletConnectButton className="!bg-[#6B4EFF] !text-white !rounded-md !px-6 !py-2 !font-semibold !shadow-lg !bg-white cursor-pointer" />
          <Button className="cursor-pointer hidden md:inline-block bg-[#00F5A0] text-black rounded-md px-6 py-0 font-semibold hover:bg-[#6B4EFF] hover:text-white transition">Get Card</Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex flex-col md:flex-row items-center justify-between gap-12 py-24 px-4 max-w-7xl mx-auto w-full">
        {/* Left: Titles and CTA */}
        <div className="flex-1 flex flex-col items-start justify-center text-left max-w-xl">
          <span className="uppercase tracking-widest text-sm font-semibold mb-4 text-[#A259FF]">The Creator Card of the New Era</span>
          <h1 className="text-5xl md:text-6xl font-black leading-tight mb-4">
            YOUR SPACE.<br />
            YOUR AUDIENCE.<br />
            <span className="bg-gradient-to-r from-[#00F5A0] to-[#6B4EFF] bg-clip-text text-transparent">YOUR RULES.</span>
          </h1>
          <p className="text-lg md:text-2xl text-zinc-200 mb-8 max-w-lg">
            Sell subscriptions, appointments, video calls, and digital content directly, instantly, and with low fees.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mb-8 w-full">
            <Button className="flex-1 cursor-pointer bg-gradient-to-r from-[#00F5A0] to-[#6B4EFF] text-black font-bold rounded-md px-8 py-4 text-lg shadow-xl hover:from-[#6B4EFF] hover:to-[#00F5A0] hover:text-white transition">
              Get my Creator Card free <span className="ml-2">⚡</span>
            </Button>
            <Button variant="outline" className="flex-1 cursor-pointer border border-[#6B4EFF] text-[#6B4EFF] rounded-md px-8 py-4 text-lg font-bold hover:bg-[#6B4EFF] hover:text-white transition">
              See examples <span className="ml-2">▶</span>
            </Button>
          </div>
          <div className="flex flex-wrap gap-6 items-center text-zinc-300 text-base mt-4">
            <span className="flex items-center gap-2"><span className="text-[#A259FF]">👥</span> 2,400 Active Creators</span>
            <span className="flex items-center gap-2"><span className="text-[#00F5A0]">$</span> 180k+ USDC Paid this month</span>
            <span className="flex items-center gap-2"><Image src="/globe.svg" alt="Solana" width={20} height={20} /> Powered by Solana</span>
          </div>
        </div>
        {/* Right: Hero Card Image */}
        <div className="flex-1 flex items-center justify-center w-full">
          <Image
            src="/hero-card-asset.png"
            alt="Creator Card Preview"
            width={420}
            height={520}
            priority
          />
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 max-w-5xl mx-auto" id="features">
        <motion.h2 className="text-3xl md:text-4xl font-bold mb-12 text-center" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>Have your store ready in 3 minutes</motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            { title: "Create your account", desc: "With your Solana wallet", icon: "💳" },
            { title: "Customize your Card", desc: "Photos, bio, colors, sections", icon: "🎨" },
            { title: "Add what you sell", desc: "Subscriptions, video calls, packs", icon: "🛒" },
            { title: "Share your link", desc: "On X, Instagram, TikTok...", icon: "🔗" },
          ].map((step, i) => (
            <motion.div key={i} className="flex flex-col items-center bg-[#121212]/80 rounded-2xl p-8 shadow-lg backdrop-blur-md"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <span className="text-4xl mb-4">{step.icon}</span>
              <h3 className="text-xl font-semibold mb-2 text-[#6B4EFF]">{step.title}</h3>
              <p className="text-zinc-300 text-center">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Creator Cards Examples */}
      <section className="py-20 px-4 max-w-6xl mx-auto" id="examples">
        <motion.h2 className="text-3xl md:text-4xl font-bold mb-12 text-center" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>Creator Cards already earning income</motion.h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {creators.map((c, i) => (
            <motion.div
              key={c.username}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="hover:scale-105 transition-transform cursor-pointer"
            >
              <Card className="rounded-2xl bg-[#1a003a]/60 shadow-xl p-6 flex flex-col items-center">
                <CardContent className="flex flex-col items-center p-0">
                  <Image src={c.img} alt={c.username} width={120} height={120} className="rounded-xl mb-4" />
                  <h3 className="text-xl font-bold mb-1">@{c.username}</h3>
                  <p className="text-zinc-300 mb-2 text-center">{c.title}</p>
                  <div className="flex gap-3 text-sm text-zinc-400 mb-2">
                    <span>👥 {c.followers}</span>
                    <span>•</span>
                    <span>👁️ {c.views}</span>
                  </div>
                  <span className="text-[#00F5A0] font-bold text-lg">{c.earned}</span>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 max-w-6xl mx-auto" id="features">
        <motion.h2 className="text-3xl md:text-4xl font-bold mb-12 text-center" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>Everything you need on one page</motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: "⚡", title: "Instant Payments", desc: "Get paid in USDC or SOL instantly to your wallet." },
            { icon: "🔄", title: "Subscriptions", desc: "Recurring payments with Streamflow." },
            { icon: "🛍️", title: "Digital Store", desc: "Sell packs, videos, PDFs, etc. Automatic delivery." },
            { icon: "🔗", title: "Viral Blinks", desc: "Every button generates a Blink to share on X." },
            { icon: "🔒", title: "Gated Access", desc: "NFTs or on-chain verification for private content." },
            { icon: "💸", title: "Tips", desc: "Receive instant tips from your fans." },
          ].map((f, i) => (
            <motion.div key={f.title} className="flex flex-col items-center bg-[#121212]/80 rounded-2xl p-8 shadow-lg backdrop-blur-md"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <span className="text-4xl mb-4">{f.icon}</span>
              <h3 className="text-xl font-semibold mb-2 text-[#00F5A0]">{f.title}</h3>
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
