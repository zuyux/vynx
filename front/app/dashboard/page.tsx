"use client";
import { useState } from "react";
import Image from "next/image";

const mockUser = {
  username: "anthoZG",
  earnings: 12.45,
  earningsChange: 2.31,
  earningsChangePct: 23.1,
  subscribers: 128,
  subscribersChange: 18,
  subscribersChangePct: 16.4,
  bookings: 24,
  bookingsChange: 6,
  bookingsChangePct: 33.3,
  tips: 2.73,
  tipsChange: 0.68,
  tipsChangePct: 33.0,
};

const recentActivity = [
  { user: "@solana_king", action: "Subscribed to VIP", amount: "+0.25 SOL", time: "2m ago", badgeColor: "bg-[#7c3aed]", badgeIcon: "👤" },
  { user: "@crypto_lover", action: "Purchased 5 Photo Pack", amount: "+0.15 SOL", time: "15m ago", badgeColor: "bg-[#0e7490]", badgeIcon: "🛍️" },
  { user: "@web3_baddie", action: "Tipped you", amount: "+0.10 SOL", time: "32m ago", badgeColor: "bg-[#be123c]", badgeIcon: "💖" },
  { user: "@degen_dreamer", action: "Booked a Video Call", amount: "+0.45 SOL", time: "1h ago", badgeColor: "bg-[#1d4ed8]", badgeIcon: "📅" },
];

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "🏠" },
  { id: "mypage", label: "My Page", icon: "👤" },
  { id: "products", label: "Products", icon: "🛍️" },
  { id: "subscriptions", label: "Subscriptions", icon: "🔄" },
  { id: "bookings", label: "Bookings", icon: "📅" },
  { id: "tips", label: "Tips", icon: "💖" },
  { id: "analytics", label: "Analytics", icon: "📊" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

export default function DashboardPage() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="min-h-screen flex bg-[#0d0d1a] text-white font-sans">
      {/* Sidebar */}
      <aside className="w-56 bg-[#111122] flex flex-col py-8 px-5 min-h-screen fixed top-0 left-0 bottom-0 z-20">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-10">
          <span className="text-2xl font-extrabold tracking-tight text-white">VYNX</span>
          <span className="text-[#A259FF] text-xl leading-none">✦</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 flex-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === item.id
                  ? "bg-[#1e1e40] text-[#A259FF]"
                  : "text-zinc-400 hover:bg-[#1a1a30] hover:text-white"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Blink promo */}
        <div className="mt-6 bg-[#1a1a30] rounded-xl p-4 flex flex-col gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#2d2d60] flex items-center justify-center text-xl">⚡</div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            <span className="font-bold text-white">Every link is a Blink.</span><br />
            Share your products, subscriptions and bookings anywhere on Solana.
          </p>
          <button className="flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-semibold rounded-lg px-4 py-2 transition">
            Create Blink <span className="text-xs">↗</span>
          </button>
        </div>

        {/* Wallet address */}
        <div className="mt-4 flex items-center justify-between bg-[#1a1a30] rounded-lg px-3 py-2">
          <span className="text-xs text-zinc-400 select-all font-mono">9h7...k3Lz</span>
          <span className="text-zinc-500 text-xs">▾</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-56 p-8 min-h-screen">
        {/* Top header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome back, <span className="text-white">{mockUser.username}</span>{" "}
              <span className="text-purple-400">💜</span>
            </h1>
            <p className="text-zinc-500 text-sm mt-1">Here's how your creator empire is performing.</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 bg-[#1a1a30] text-white text-sm font-semibold rounded-lg px-4 py-2.5 hover:bg-[#23234a] transition border border-[#2d2d50]">
              View My Page <span className="text-xs opacity-70">↗</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-zinc-700 overflow-hidden border-2 border-[#A259FF]">
                <Image src="/mocks/avatar1.png" alt="Profile" width={40} height={40} />
              </div>
              <span className="text-zinc-400 text-sm">▾</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Earnings", value: `${mockUser.earnings} SOL`, change: `+${mockUser.earningsChange} SOL (${mockUser.earningsChangePct}%)`, icon: "💲", iconBg: "bg-[#2d1f5e]" },
            { label: "Subscribers", value: mockUser.subscribers, change: `+${mockUser.subscribersChange} (${mockUser.subscribersChangePct}%)`, icon: "👥", iconBg: "bg-[#0f3d3e]" },
            { label: "Bookings", value: mockUser.bookings, change: `+${mockUser.bookingsChange} (${mockUser.bookingsChangePct}%)`, icon: "📅", iconBg: "bg-[#1a2a50]" },
            { label: "Tips Received", value: `${mockUser.tips} SOL`, change: `+${mockUser.tipsChange} SOL (${mockUser.tipsChangePct}%)`, icon: "💖", iconBg: "bg-[#3d1229]" },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#141428] rounded-xl p-5 flex items-center gap-4 border border-[#1e1e40]">
              <div className={`w-12 h-12 rounded-full ${stat.iconBg} flex items-center justify-center text-xl flex-shrink-0`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-1">{stat.label}</p>
                <p className="text-2xl font-bold leading-tight">{stat.value}</p>
                <p className="text-green-400 text-xs font-semibold mt-0.5">{stat.change}</p>
                <p className="text-zinc-600 text-xs">vs last 7 days</p>
              </div>
            </div>
          ))}
        </div>

        {/* Earnings Chart & Recent Activity */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
          {/* Earnings Chart */}
          <div className="xl:col-span-2 bg-[#141428] rounded-xl p-6 border border-[#1e1e40]">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-base">Earnings</span>
              <button className="flex items-center gap-1 bg-[#1e1e40] text-zinc-300 text-xs rounded-lg px-3 py-1.5 border border-[#2d2d50]">
                Last 7 days <span>▾</span>
              </button>
            </div>
            <div className="text-2xl font-bold mt-2">{mockUser.earnings} SOL</div>
            <div className="text-green-400 text-xs font-semibold mb-4">
              +{mockUser.earningsChange} SOL ({mockUser.earningsChangePct}%) vs last 7 days
            </div>
            {/* Chart area */}
            <div className="relative h-36">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-zinc-600 text-xs w-10">
                <span>3 SOL</span>
                <span>2 SOL</span>
                <span>1 SOL</span>
                <span>0 SOL</span>
              </div>
              {/* SVG chart */}
              <div className="ml-10 h-full flex flex-col justify-between">
                <svg viewBox="0 0 560 100" className="w-full h-24" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,90 C40,85 80,78 120,70 C160,62 200,55 240,45 C280,35 320,28 360,20 C400,12 440,8 480,5 C510,3 540,2 560,0"
                    fill="none" stroke="#7c3aed" strokeWidth="2.5"
                  />
                  <path
                    d="M0,90 C40,85 80,78 120,70 C160,62 200,55 240,45 C280,35 320,28 360,20 C400,12 440,8 480,5 C510,3 540,2 560,0 L560,100 L0,100 Z"
                    fill="url(#chartGrad)"
                  />
                  <circle cx="560" cy="0" r="5" fill="#7c3aed" />
                </svg>
                {/* X-axis dates */}
                <div className="flex justify-between text-zinc-600 text-xs mt-1 px-0.5">
                  {["May 8","May 9","May 10","May 11","May 12","May 13","May 14"].map(d => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-[#141428] rounded-xl p-5 border border-[#1e1e40]">
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-base">Recent Activity</span>
              <button className="text-[#A259FF] text-xs font-semibold hover:underline">View All</button>
            </div>
            <ul className="flex flex-col gap-4">
              {recentActivity.map((a, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-full bg-zinc-700 overflow-hidden">
                      <Image src="/mocks/vynx-card.png" alt={a.user} width={36} height={36} />
                    </div>
                    <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${a.badgeColor} flex items-center justify-center text-[9px] border border-[#141428]`}>
                      {a.badgeIcon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{a.user}</p>
                    <p className="text-xs text-zinc-500 truncate">{a.action}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-green-400 text-xs font-bold">{a.amount}</p>
                    <p className="text-zinc-600 text-xs">{a.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-[#141428] rounded-xl p-6 border border-[#1e1e40]">
          <h2 className="font-bold text-base mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { icon: "🛍️", label: "Create Product", sub: "Sell digital content", iconBg: "bg-[#0f3d3e]" },
              { icon: "👥", label: "New Subscription", sub: "Create a subscription", iconBg: "bg-[#0f3d3e]" },
              { icon: "📅", label: "Book a Call", sub: "Add available slots", iconBg: "bg-[#1a2a50]" },
              { icon: "💸", label: "Send Tip Link", sub: "Share your tip link", iconBg: "bg-[#3d1229]" },
            ].map((action) => (
              <button
                key={action.label}
                className="flex flex-col items-center gap-3 bg-[#1a1a30] hover:bg-[#23234a] rounded-xl p-5 transition border border-[#2d2d50]"
              >
                <div className={`w-12 h-12 rounded-full ${action.iconBg} flex items-center justify-center text-2xl`}>
                  {action.icon}
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">{action.label}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">{action.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
            <span className="font-bold">Book a Call</span>
            <span className="text-zinc-400 text-sm">Add available slots</span>
          </button>
          <button className="bg-[#23234a] rounded-xl p-6 flex flex-col items-center hover:bg-[#18181b] transition">
            <span className="text-3xl mb-2">💸</span>
            <span className="font-bold">Send Tip Link</span>
            <span className="text-zinc-400 text-sm">Share your tip link</span>
          </button>
        </div>
      </main>
    </div>
  );
}