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
    <div className="min-h-screen flex bg-[#000000] text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-[#131325] flex flex-col py-8 px-6 gap-6 min-h-screen">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-3xl font-extrabold text-[#A259FF]">VYNX</span>
          <span className="ml-1 text-2xl">✦</span>
        </div>
        <nav className="flex flex-col gap-2 text-lg font-medium">
          <button className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${tab === "dashboard" ? "bg-[#23234a] text-[#A259FF]" : "hover:bg-[#18181b]"}`} onClick={() => setTab("dashboard")}> <span>🏠</span> Dashboard</button>
          <button className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-[#18181b]"> <span>👤</span> My Page</button>
          <button className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-[#18181b]"> <span>🛍️</span> Products</button>
          <button className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-[#18181b]"> <span>🔄</span> Subscriptions</button>
          <button className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-[#18181b]"> <span>📅</span> Bookings</button>
          <button className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-[#18181b]"> <span>💸</span> Tips</button>
          <button className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-[#18181b]"> <span>📊</span> Analytics</button>
          <button className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-[#18181b]"> <span>⚙️</span> Settings</button>
        </nav>
        <div className="mt-auto bg-[#18181b] rounded-xl p-4 flex flex-col gap-2">
          <span className="text-sm text-zinc-300">Every link is a Blink.<br/>Share your products, subscriptions and bookings anywhere on Solana.</span>
          <button className="mt-2 bg-gradient-to-r from-[#A259FF] to-[#6B4EFF] text-white font-bold rounded-lg px-4 py-2 transition">Create Blink</button>
        </div>
        <div className="mt-6 text-xs text-zinc-400 bg-[#23234a] rounded-lg px-3 py-2 select-all">9h7...k3Lz</div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 bg-[#0a0a13] min-h-screen">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, <span className="text-[#A259FF]">{mockUser.username}</span> <span className="text-xl">💜</span></h1>
            <p className="text-zinc-400 mt-1">Here's how your creator empire is performing.</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="bg-[#23234a] text-white px-5 py-2 rounded-lg font-semibold hover:bg-[#18181b] transition">View My Page</button>
            <div className="w-12 h-12 rounded-full bg-zinc-700 overflow-hidden">
              <Image src="/mocks/avatar1.png" alt="Profile" width={48} height={48} />
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-[#18181b] rounded-xl p-6 flex flex-col items-center">
            <span className="text-3xl mb-2">💲</span>
            <span className="text-2xl font-bold">{mockUser.earnings} SOL</span>
            <span className="text-green-400 font-semibold">+{mockUser.earningsChange} SOL ({mockUser.earningsChangePct}%)</span>
            <span className="text-zinc-400 text-xs mt-1">vs last 7 days</span>
          </div>
          <div className="bg-[#18181b] rounded-xl p-6 flex flex-col items-center">
            <span className="text-3xl mb-2">👥</span>
            <span className="text-2xl font-bold">{mockUser.subscribers}</span>
            <span className="text-green-400 font-semibold">+{mockUser.subscribersChange} ({mockUser.subscribersChangePct}%)</span>
            <span className="text-zinc-400 text-xs mt-1">vs last 7 days</span>
          </div>
          <div className="bg-[#18181b] rounded-xl p-6 flex flex-col items-center">
            <span className="text-3xl mb-2">📅</span>
            <span className="text-2xl font-bold">{mockUser.bookings}</span>
            <span className="text-green-400 font-semibold">+{mockUser.bookingsChange} ({mockUser.bookingsChangePct}%)</span>
            <span className="text-zinc-400 text-xs mt-1">vs last 7 days</span>
          </div>
          <div className="bg-[#18181b] rounded-xl p-6 flex flex-col items-center">
            <span className="text-3xl mb-2">💖</span>
            <span className="text-2xl font-bold">{mockUser.tips} SOL</span>
            <span className="text-green-400 font-semibold">+{mockUser.tipsChange} SOL ({mockUser.tipsChangePct}%)</span>
            <span className="text-zinc-400 text-xs mt-1">vs last 7 days</span>
          </div>
        </div>

        {/* Earnings Chart & Recent Activity */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div className="md:col-span-2 bg-[#18181b] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-lg">Earnings</span>
              <select className="bg-[#23234a] text-white rounded px-3 py-1 text-sm">
                <option>Last 7 days</option>
              </select>
            </div>
            {/* Placeholder for chart */}
            <div className="h-40 flex items-end">
              <div className="w-full h-32 bg-gradient-to-t from-[#A259FF]/40 to-transparent rounded-b-xl" />
            </div>
            <div className="mt-4 text-2xl font-bold">{mockUser.earnings} SOL</div>
            <div className="text-green-400 font-semibold">+{mockUser.earningsChange} SOL ({mockUser.earningsChangePct}%) vs last 7 days</div>
          </div>
          <div className="bg-[#18181b] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-lg">Recent Activity</span>
              <button className="text-[#A259FF] text-sm font-semibold">View All</button>
            </div>
            <ul className="flex flex-col gap-4">
              {recentActivity.map((a, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-700 overflow-hidden">
                    <Image src={a.avatar} alt={a.user} width={40} height={40} />
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold text-white">{a.user}</span>
                    <span className="block text-zinc-400 text-sm">{a.action}</span>
                  </div>
                  <span className="text-green-400 font-bold">{a.amount}</span>
                  <span className="text-zinc-500 text-xs ml-2">{a.time}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <button className="bg-[#23234a] rounded-xl p-6 flex flex-col items-center hover:bg-[#18181b] transition">
            <span className="text-3xl mb-2">🛍️</span>
            <span className="font-bold">Create Product</span>
            <span className="text-zinc-400 text-sm">Sell digital content</span>
          </button>
          <button className="bg-[#23234a] rounded-xl p-6 flex flex-col items-center hover:bg-[#18181b] transition">
            <span className="text-3xl mb-2">👥</span>
            <span className="font-bold">New Subscription</span>
            <span className="text-zinc-400 text-sm">Create a subscription</span>
          </button>
          <button className="bg-[#23234a] rounded-xl p-6 flex flex-col items-center hover:bg-[#18181b] transition">
            <span className="text-3xl mb-2">📅</span>
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