"use client";
import { useState } from "react";
import Image from "next/image";

const TABS = [
  { id: "suscripcion", label: "Suscripción", icon: "∞" },
  { id: "videollamadas", label: "Videollamadas", icon: "📹" },
  { id: "tienda", label: "Tienda", icon: "🛍️" },
  { id: "exclusivo", label: "Contenido\nExclusivo", icon: "🔒" },
  { id: "propinas", label: "Propinas", icon: "💖" },
  { id: "sobre", label: "Sobre mí", icon: "👤" },
];

const STORE_ITEMS = [
  { img: "/mocks/vynx-card.png", title: "Pack Fotos Premium", sub: "10 fotos exclusivas", price: "$14.99 USDC" },
  { img: "/mocks/vynx-card.png", title: "Video Especial", sub: "Video personalizado", price: "$24.99 USDC" },
  { img: "/mocks/vynx-card.png", title: "Mega Pack", sub: "Fotos + Videos + Bonus", price: "$49.99 USDC" },
];

const SOCIALS = [
  { icon: "𝕏", label: "X", handle: "@lunasol", bg: "#111" },
  { icon: "📸", label: "Instagram", handle: "@lunasol", bg: "#2d1040" },
  { icon: "🎵", label: "TikTok", handle: "@lunasol", bg: "#111" },
  { icon: "▶️", label: "YouTube", handle: "Luna Sol", bg: "#200a0a" },
  { icon: "💬", label: "Discord", handle: "Únete", bg: "#0a1030" },
  { icon: "✈️", label: "Telegram", handle: "@lunasolvip", bg: "#0a1a30" },
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("suscripcion");
  const [callDuration, setCallDuration] = useState(15);
  const [tipAmount, setTipAmount] = useState<number | null>(null);

  return (
    <div className="min-h-screen font-sans" style={{ background: "#07070A", color: "#fff" }}>
      {/* ── Navbar ── */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-10 h-14"
        style={{ background: "rgba(7,7,10,0.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="VYNX" width={70} height={22} style={{ height: "auto" }} />
        </div>
        <div className="flex items-center gap-3">
          <button
            className="flex items-center gap-1.5 text-xs font-semibold text-white px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 transition"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <span>🔗</span> Share VYNX
          </button>
          <button className="text-zinc-400 hover:text-white transition text-lg px-1">···</button>
          <button
            className="text-sm font-bold text-white px-5 py-2 rounded-xl transition"
            style={{ background: "linear-gradient(135deg,#6B4EFF,#A855F7)" }}
          >
            Follow
          </button>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative w-full" style={{ minHeight: 480 }}>
        <div className="max-w-5xl mx-auto px-4 md:px-8 flex flex-col md:flex-row gap-0 items-stretch" style={{ minHeight: 480 }}>
          {/* Left: Creator photo */}
          <div className="relative flex-1 min-h-85 md:min-h-120 rounded-3xl overflow-hidden mr-0 md:mr-8 mt-6">
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(135deg, #1a003a 0%, #3b0149 50%, #0a0018 100%)",
              }}
            />
            {/* Neon text overlay */}
            <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10">
              {["Create", "Connect", "Earn"].map((word) => (
                <span
                  key={word}
                  className="text-4xl font-black leading-tight"
                  style={{
                    color: "#A855F7",
                    textShadow: "0 0 30px #A855F7, 0 0 60px #6B4EFF",
                    fontStyle: "italic",
                  }}
                >
                  {word}
                </span>
              ))}
            </div>
            {/* Creator image placeholder */}
            <div className="absolute inset-0 flex items-end justify-end">
              <div
                className="w-64 h-full"
                style={{
                  background: "linear-gradient(to top, rgba(107,78,255,0.3) 0%, transparent 60%)",
                }}
              />
            </div>
            {/* Floating About Me card */}
            <div
              className="absolute bottom-5 left-5 right-5 md:right-auto md:w-64 p-4 rounded-2xl z-20"
              style={{
                backdropFilter: "blur(20px)",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <p className="text-xs font-semibold text-white mb-1">Sobre mí</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Amo conectar con las personas que realmente me apoyan. Aquí es donde la magia pasa ✨
              </p>
              <button className="mt-2 text-zinc-500 text-xs">▾</button>
            </div>
          </div>

          {/* Right: Creator info */}
          <div className="flex-1 flex flex-col justify-center py-8 md:py-10">
            {/* Name & badges */}
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-none">Luna Sol</h1>
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                style={{ background: "#6B4EFF" }}
              >✓</span>
            </div>
            <p className="text-[#6B4EFF] font-semibold text-base mb-3">@lunasol</p>
            <p className="text-zinc-300 text-sm leading-relaxed mb-4 max-w-sm">
              Modelo • Creadora de contenido • Tu fantasía hecha realidad.<br />
              Contenido exclusivo, videollamadas y más.
            </p>
            {/* Tags */}
            <div className="flex gap-2 mb-6 flex-wrap">
              {[
                { label: "18+", color: "#3d0a0a" },
                { label: "🌀 Solana", color: "#0a1a3d" },
                { label: "🔵 USDC", color: "#0a1a3d" },
              ].map((tag) => (
                <span
                  key={tag.label}
                  className="text-xs font-semibold px-3 py-1 rounded-full text-white"
                  style={{ background: tag.color, border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  {tag.label}
                </span>
              ))}
            </div>
            {/* Stats */}
            <div className="flex gap-10 mb-7">
              <div>
                <p className="text-xl font-bold">43.2K</p>
                <p className="text-xs text-zinc-500">Followers</p>
              </div>
              <div>
                <p className="text-xl font-bold">1.2M+</p>
                <p className="text-xs text-zinc-500">Views</p>
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: "#00F5A0" }}>$57,340</p>
                <p className="text-xs" style={{ color: "#00F5A0" }}>Earned</p>
              </div>
            </div>
            {/* Subscribe CTA */}
            <button
              className="w-full max-w-sm flex items-center justify-between px-6 rounded-2xl font-bold text-base text-white transition hover:opacity-90"
              style={{
                height: 60,
                background: "linear-gradient(90deg, #A855F7, #00F5A0)",
                boxShadow: "0 0 40px rgba(168,85,247,0.4)",
              }}
            >
              <span>Subscribe $9.99 / mes</span>
              <span className="text-xl">⚡</span>
            </button>
            <p className="text-xs text-zinc-500 mt-2 max-w-sm text-center">
              Cancel anytime • Pago en USDC • Acceso instantáneo
            </p>
          </div>
        </div>
      </section>

      {/* ── Action Navigation ── */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 mt-6">
        <div
          className="grid grid-cols-6 rounded-2xl overflow-hidden"
          style={{ background: "#0D0D12", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center justify-center gap-1.5 py-4 text-xs font-medium transition-all relative"
              style={{
                color: activeTab === tab.id ? "#A855F7" : "#6b7280",
              }}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className="whitespace-pre-line text-center leading-tight">{tab.label}</span>
              {activeTab === tab.id && (
                <span
                  className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full"
                  style={{ background: "#A855F7" }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Monetization Modules ── */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 mt-6 grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Subscription Card */}
        <div
          className="rounded-3xl p-8 flex flex-col gap-4"
          style={{ background: "#0D0D12", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2 text-[#A855F7] font-bold text-sm uppercase tracking-widest">
            <span>∞</span> Suscripción
          </div>
          <p className="text-zinc-400 text-sm">
            Acceso total a todo mi contenido exclusivo y beneficios.
          </p>
          <ul className="flex flex-col gap-2 text-sm text-zinc-300">
            {["Contenido exclusivo", "Chats privados", "Stories diarias", "Descuentos especiales"].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span style={{ color: "#A855F7" }}>✓</span> {f}
              </li>
            ))}
          </ul>
          <button
            className="mt-auto flex items-center justify-between px-5 py-3 rounded-xl font-bold text-sm text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(90deg,#A855F7,#6B4EFF)" }}
          >
            Suscribirme $9.99 / mes <span>⚡</span>
          </button>
        </div>

        {/* Video Call Card */}
        <div
          className="rounded-3xl p-8 flex flex-col gap-4 relative"
          style={{ background: "#0D0D12", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span
            className="absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full"
            style={{ background: "#00F5A0", color: "#000" }}
          >
            Popular
          </span>
          <div className="flex items-center gap-2 text-[#00F5A0] font-bold text-sm uppercase tracking-widest">
            <span>📹</span> Videollamadas
          </div>
          <p className="text-zinc-400 text-sm">Reserva una videollamada 1:1 conmigo.</p>
          <div className="flex flex-col gap-2">
            {[
              { min: 15, price: "$29.99 USDC" },
              { min: 30, price: "$49.99 USDC" },
              { min: 60, price: "$89.99 USDC" },
            ].map((opt) => (
              <button
                key={opt.min}
                onClick={() => setCallDuration(opt.min)}
                className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition"
                style={{
                  background: callDuration === opt.min ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.04)",
                  border: callDuration === opt.min ? "1px solid #A855F7" : "1px solid rgba(255,255,255,0.07)",
                  color: callDuration === opt.min ? "#fff" : "#a1a1aa",
                }}
              >
                <span>{opt.min} minutos</span>
                <span style={{ color: callDuration === opt.min ? "#00F5A0" : "#71717a" }}>{opt.price}</span>
              </button>
            ))}
          </div>
          <button
            className="mt-auto w-full py-3 rounded-xl font-bold text-sm text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(90deg,#A855F7,#00F5A0)" }}
          >
            Reservar ahora
          </button>
        </div>

        {/* Store Card */}
        <div
          className="rounded-3xl p-8 flex flex-col gap-4"
          style={{ background: "#0D0D12", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2 text-[#FF4EC6] font-bold text-sm uppercase tracking-widest">
            <span>🛍️</span> Tienda
          </div>
          <p className="text-zinc-400 text-sm">Packs, fotos, videos y contenido digital exclusivo.</p>
          <div className="flex flex-col gap-3">
            {STORE_ITEMS.map((item) => (
              <div key={item.title} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-zinc-800">
                  <Image src={item.img} alt={item.title} width={48} height={48} className="object-cover w-full h-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold truncate">{item.title}</p>
                  <p className="text-zinc-500 text-xs">{item.sub}</p>
                </div>
                <span className="text-xs font-bold shrink-0" style={{ color: "#00F5A0" }}>{item.price}</span>
              </div>
            ))}
          </div>
          <button
            className="mt-auto w-full py-3 rounded-xl font-bold text-sm text-white transition hover:opacity-90"
            style={{ background: "rgba(255,78,198,0.15)", border: "1px solid rgba(255,78,198,0.3)", color: "#FF4EC6" }}
          >
            Ver tienda
          </button>
        </div>
      </div>

      {/* ── Exclusive Content Grid ── */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold uppercase tracking-widest" style={{ color: "#A855F7" }}>
            🔒 Contenido Exclusivo
          </h2>
          <button className="text-xs text-zinc-400 hover:text-white transition flex items-center gap-1">
            Ver todo →
          </button>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-2xl overflow-hidden relative flex items-center justify-center"
              style={{ background: "#111118" }}
            >
              <Image
                src="/mocks/vynx-card.png"
                alt="locked"
                fill
                className="object-cover opacity-40"
              />
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.45)" }}
              >
                <span className="text-2xl">🔒</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tips Section ── */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: tip buttons */}
        <div
          className="rounded-3xl p-8 flex flex-col gap-5"
          style={{ background: "#0D0D12", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2 text-[#FF4EC6] font-bold text-base">
            <span>💖</span> Propina a Luna
          </div>
          <p className="text-zinc-400 text-sm">¿Te gusta mi contenido? Apóyame con una propina 🧡</p>
          <div className="grid grid-cols-3 gap-3">
            {[5, 10, 25, 50, 100].map((amt) => (
              <button
                key={amt}
                onClick={() => setTipAmount(amt)}
                className="py-2.5 rounded-xl text-sm font-bold transition"
                style={{
                  background: tipAmount === amt ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.05)",
                  border: tipAmount === amt ? "1px solid #A855F7" : "1px solid rgba(255,255,255,0.08)",
                  color: tipAmount === amt ? "#A855F7" : "#d4d4d8",
                }}
              >
                ${amt}
              </button>
            ))}
            <button
              onClick={() => setTipAmount(null)}
              className="py-2.5 rounded-xl text-sm font-bold transition"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#d4d4d8",
              }}
            >
              Otro
            </button>
          </div>
          <button
            className="w-full py-3 rounded-xl font-bold text-sm text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(90deg,#FF4EC6,#A855F7)" }}
          >
            Enviar propina {tipAmount ? `$${tipAmount}` : ""}
          </button>
        </div>

        {/* Right: revenue ownership */}
        <div
          className="rounded-3xl p-8 flex flex-col justify-center gap-3 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#050510 0%,#0e1035 100%)", border: "1px solid rgba(107,78,255,0.3)" }}
        >
          <div className="absolute right-4 bottom-4 opacity-30 text-8xl pointer-events-none">💰</div>
          <p
            className="text-2xl font-extrabold"
            style={{ color: "#00F5A0", textShadow: "0 0 20px #00F5A0" }}
          >
            100% tuyo
          </p>
          <p className="text-zinc-300 text-sm leading-relaxed">
            Recibo el 95% de cada pago.<br />
            Gracias por apoyar mi trabajo 💜
          </p>
        </div>
      </div>

      {/* ── Social Links ── */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 mt-10">
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">Sígueme en</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {SOCIALS.map((s) => (
            <button
              key={s.label}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl transition hover:border-white/20"
              style={{
                background: s.bg,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span className="text-base">{s.icon}</span>
              <div className="text-left min-w-0">
                <p className="text-xs font-bold text-white">{s.label}</p>
                <p className="text-[10px] text-zinc-500 truncate">{s.handle}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <footer
        className="mt-14 border-t"
        style={{ borderColor: "rgba(255,255,255,0.05)", background: "#050507" }}
      >
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Image src="/logo.png" alt="VYNX" width={60} height={20} style={{ height: "auto" }} />
            <span className="text-xs text-zinc-600">Tu espacio. Tu audiencia. Tus reglas.</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <span>Built on</span>
            <span className="font-bold text-[#9945FF]">◎ SOLANA</span>
          </div>
          <button className="text-xs text-zinc-600 hover:text-zinc-400 transition">
            Reportar 🚩
          </button>
        </div>
      </footer>
    </div>
  );
}
