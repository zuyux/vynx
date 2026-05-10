"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "🏠", href: "/dashboard" },
  { id: "mypage", label: "My Page", icon: "/personalcard.svg", href: "/dashboard/mypage" },
  { id: "products", label: "Products", icon: "/gift.svg", href: "/dashboard/products" },
  { id: "subscriptions", label: "Subscriptions", icon: "/heart-add.svg", href: "/dashboard/subscriptions" },
  { id: "bookings", label: "Bookings", icon: "/calendar.svg", href: "/dashboard/bookings" },
  { id: "tips", label: "Tips", icon: "/wallet-money.svg", href: "/dashboard/tips" },
  { id: "analytics", label: "Analytics", icon: "📊", href: "/dashboard/analytics" },
  { id: "settings", label: "Settings", icon: "⚙️", href: "/dashboard/settings" },
];

export function Sidebar({ walletAddress = "9h7...k3Lz" }: { walletAddress?: string }) {
  const pathname = usePathname();

  return (
    <aside
      className="w-64 flex flex-col py-8 px-5 min-h-screen fixed top-0 left-0 bottom-0 z-20"
      style={{ background: "#07070A", borderRight: "1px solid rgba(255,255,255,0.05)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <Image src="/logo.png" alt="VYNX" width={80} height={32} style={{ height: "auto" }} />
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "text-white"
                  : "text-zinc-500 hover:text-white hover:bg-white/5"
              }`}
              style={
                isActive
                  ? {
                      background:
                        "linear-gradient(135deg, rgba(107,78,255,.25), rgba(255,0,255,.12))",
                    }
                  : {}
              }
            >
              {item.icon.startsWith("/") ? (
                <Image src={item.icon} alt={item.label} width={20} height={20} className="shrink-0 opacity-80" />
              ) : (
                <span className="text-base leading-none w-5 text-center">{item.icon}</span>
              )}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Creator URL card */}
      <div className="mt-4 bg-white/5 rounded-xl p-4 flex flex-col gap-2 border border-white/5">
        <p className="text-xs text-zinc-500">Your VYNX Page</p>
        <a
          href="#"
          className="text-sm font-semibold text-[#6B4EFF] hover:underline flex items-center gap-1"
        >
          vynx.me/{walletAddress.slice(0, 6)} <span className="text-xs opacity-60">↗</span>
        </a>
        <p className="text-xs text-zinc-600">Share your link anywhere.</p>
        <button className="mt-1 flex items-center gap-2 justify-center bg-[#6B4EFF] hover:bg-[#5a3edc] text-white text-xs font-semibold rounded-lg px-3 py-2 transition">
          View My Page <span>↗</span>
        </button>
      </div>

      {/* Wallet */}
      <div className="mt-3 flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5 border border-white/5">
        <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden">
          <Image src="/mocks/vynx-card.png" alt="avatar" width={32} height={32} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white font-semibold truncate">anthozg</p>
          <p className="text-xs text-zinc-500 font-mono truncate">{walletAddress}</p>
        </div>
        <span className="text-zinc-600 text-xs">▾</span>
      </div>
    </aside>
  );
}
