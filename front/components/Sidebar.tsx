"use client";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { usePathname } from "next/navigation";
import { ArrowUpRight, House, PanelTop, Sparkles, Wallet, Video } from "lucide-react";
import { useClaimedAlias } from "@/lib/use-claimed-alias";
import { useWalletSession } from "@/components/WalletSessionProvider";

const navigation = [
  { label: "Resumen", icon: House, href: "/dashboard" },
  { label: "Mi página", icon: PanelTop, href: "/dashboard/card" },
  { label: "Videollamadas", icon: Video, href: "/dashboard/bookings" },
  { label: "Patrocinios", icon: Sparkles, href: "/dashboard/sponsorships" },
];
export function Sidebar({ creatorAlias }: { creatorAlias?: string }) {
  const pathname = usePathname();
  const { wallet } = useWalletSession();
  const { alias } = useClaimedAlias(wallet);
  return <aside className="border-b border-white/10 bg-[#09090e] px-5 py-4 lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-b-0 lg:px-6 lg:py-8">
    <div className="flex items-center justify-between lg:mb-12"><BrandLogo /><span className="rounded-md border border-white/10 px-2 py-1 text-[10px] uppercase tracking-widest text-zinc-400">Creator</span></div>
    <nav aria-label="Panel del creador" className="mt-4 flex flex-wrap gap-2 lg:mt-0 lg:flex-col">{navigation.map(({ label, icon: Icon, href }) => {
      const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-[#00F5A0] sm:text-sm lg:justify-start lg:gap-3 lg:px-4 ${active ? "bg-[#00F5A0]/10 text-[#00F5A0]" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}><Icon size={18} aria-hidden="true" className="shrink-0" />{label}</Link>;
    })}</nav>
    <div className="mt-8 hidden px-4 lg:block"><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-zinc-400">En desarrollo</p><p className="mt-4 text-sm text-zinc-400">Tickets y suscripciones: vista previa</p></div>
    <div className="mt-auto hidden pt-8 lg:block"><div className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-transparent p-4"><Sparkles size={20} className="mb-3 text-violet-300" aria-hidden="true" /><p className="text-sm font-semibold text-white">Un espacio para tu marca</p><p className="mt-2 text-xs leading-5 text-zinc-400">Publica tu oferta y conecta con tu próximo patrocinador.</p><Link href={creatorAlias ? `/creators/${creatorAlias}` : "/dashboard/sponsorships"} className="mt-4 flex items-center justify-between text-xs font-semibold text-violet-300">{creatorAlias ? "Ver mi página pública" : "Crear mi oferta"}<ArrowUpRight size={16} aria-hidden="true" /></Link></div><div className="mt-5 flex items-center gap-3 border-t border-white/10 pt-5"><Wallet size={18} className="text-zinc-400" aria-hidden="true" /><div><p className="text-xs font-medium text-white">{alias ? `@${alias}` : wallet ? "Wallet conectada" : "Tu espacio de creador"}</p><p title={wallet || undefined} className="mt-1 text-xs text-zinc-400">{wallet ? `${wallet.slice(0, 5)}…${wallet.slice(-4)}` : "Conecta para empezar"}</p></div></div></div>
  </aside>;
}
