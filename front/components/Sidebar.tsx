"use client";
import { useCopy } from "@/i18n/copy";

import Link from '@/i18n/link';
import { BrandLogo } from "@/components/BrandLogo";
import { usePathname } from '@/i18n/navigation';
import { ArrowUpRight, House, PanelTop, Sparkles, Wallet, Video, CalendarClock } from "lucide-react";
import { useClaimedAlias } from "@/lib/use-claimed-alias";
import { useWalletSession } from "@/components/WalletSessionProvider";

const navigation = [
  { label: "Overview", icon: House, href: "/dashboard" },
  { label: "My Card", icon: PanelTop, href: "/dashboard/card" },
  { label: "Monthly plans", icon: CalendarClock, href: "/dashboard/monthly" },
  { label: "Video calls", icon: Video, href: "/dashboard/bookings" },
  { label: "Sponsorships", icon: Sparkles, href: "/dashboard/sponsorships" },
];
export function Sidebar({ creatorAlias }: { creatorAlias?: string }) {
  const t = useCopy();
  const pathname = usePathname();
  const { wallet } = useWalletSession();
  const { alias } = useClaimedAlias(wallet);
  return <aside className="border-b border-white/10 bg-[#09090e] px-5 py-4 lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-b-0 lg:px-6 lg:py-8">
    <div className="flex items-center justify-between lg:mb-12"><BrandLogo /><span className="rounded-md border border-white/10 px-2 py-1 text-[10px] uppercase tracking-widest text-zinc-400">{t("Creator")}</span></div>
    <nav aria-label={t("Creator dashboard")} className="mt-4 flex flex-wrap gap-2 lg:mt-0 lg:flex-col">{navigation.map(({ label, icon: Icon, href }) => {
      const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-1 basis-[calc(50%-0.25rem)] items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-[#00F5A0] sm:basis-auto sm:flex-none sm:text-sm lg:w-full lg:justify-start lg:gap-3 lg:px-4 ${active ? "bg-[#00F5A0]/10 text-[#00F5A0]" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}><Icon size={18} aria-hidden="true" className="shrink-0" />{t(label)}</Link>;
    })}</nav>

    <div className="mt-auto hidden pt-8 lg:block"><div className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-transparent p-4"><Sparkles size={20} className="mb-3 text-violet-300" aria-hidden="true" /><p className="text-sm font-semibold text-white">{t("A space for your brand")}</p><p className="mt-2 text-xs leading-5 text-zinc-400">{t("Publish your offer and connect with your next sponsor.")}</p><Link href={creatorAlias ? `/creators/${creatorAlias}` : "/dashboard/sponsorships"} className="mt-4 flex items-center justify-between text-xs font-semibold text-violet-300">{creatorAlias ? t("View my public page") : t("Create my offer")}<ArrowUpRight size={16} aria-hidden="true" /></Link></div><div className="mt-5 flex items-center gap-3 border-t border-white/10 pt-5"><Wallet size={18} className="text-zinc-400" aria-hidden="true" /><div><p className="text-xs font-medium text-white">{alias ? `@${alias}` : wallet ? t("Wallet connected") : t("Your creator space")}</p><p title={wallet || undefined} className="mt-1 text-xs text-zinc-400">{wallet ? `${wallet.slice(0, 5)}…${wallet.slice(-4)}` : t("Connect to get started")}</p></div></div></div>
  </aside>;
}
