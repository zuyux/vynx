"use client";
import { userErrorMessage } from '@/lib/user-facing-error';

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, Check, Copy, Inbox, LayoutTemplate, RefreshCw, Sparkles, Wallet } from "lucide-react";
import { LoadingState } from '@/components/LoadingState';
import { CreatorTipSummary } from "@/components/CreatorTipSummary";
import { Sidebar } from "@/components/Sidebar";
import SponsorshipWalletControl from "@/components/SponsorshipWalletControl";
import { useSponsorshipWallet } from "@/lib/use-sponsorship-wallet";
import { isLive, money, type SponsorProfile, type SponsorRequest } from "@/lib/sponsorship-domain";

const panel = "rounded-2xl border border-white/10 bg-[#101015]";
const primary = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#00F5A0] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#8affd6] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00F5A0]";
const statusLabels = { pending: "En revisión", approved: "Pendiente de pago", rejected: "Rechazada", active: "Publicada" };

export default function DashboardPage() {
  const { wallet, open, signed } = useSponsorshipWallet();
  const [snapshot, setSnapshot] = useState<{ wallet: string; profile: SponsorProfile | null; campaigns: SponsorRequest[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const loaded = !!wallet && snapshot?.wallet === wallet;
  const profile = loaded ? snapshot.profile : null;
  const campaigns = loaded ? snapshot.campaigns : [];
  const received = campaigns.filter(c => c.creator_wallet === wallet);
  const pending = received.filter(c => c.status === "pending");
  const active = received.filter(c => isLive(c));
  const earnings = received.filter(c => c.status === "active").reduce((sum, c) => sum + c.price_cents, 0);

  async function refresh() {
    setBusy(true); setError("");
    try {
      const result = await signed("list");
      setSnapshot({ wallet, profile: result.profile, campaigns: result.campaigns });
    } catch (reason) { setError(userErrorMessage(reason, "No se pudo cargar tu resumen. Vuelve a intentarlo.")); }
    finally { setBusy(false); }
  }
  async function copyPage() {
    if (!profile) return;
    try { await navigator.clipboard.writeText(`${window.location.origin}/creators/${profile.alias}`); setCopyNotice("Enlace copiado."); }
    catch { setCopyNotice("No se pudo copiar. Abre tu página y copia el enlace del navegador."); }
  }
  const steps = [
    { label: "Conecta tu wallet", description: "Tu identidad y tus pagos, en un solo lugar.", done: !!wallet },
    { label: "Publica tu oferta", description: "Define tu precio y el tiempo de publicación.", done: !!profile },
    { label: "Recibe tu primera propuesta", description: "Comparte tu enlace con una marca para empezar.", done: received.length > 0 },
  ];
  const stats = [
    { label: "Ingresos verificados", value: loaded ? `${money(earnings)} USDC` : "—", detail: "En las campañas cargadas · tokens de prueba", icon: Wallet, color: "text-[#00F5A0] bg-[#00F5A0]/10" },
    { label: "Propuestas por revisar", value: loaded ? pending.length : "—", detail: "Marcas esperando tu respuesta", icon: Inbox, color: "text-violet-300 bg-violet-400/10" },
    { label: "Patrocinios activos", value: loaded ? active.length : "—", detail: "Publicados en tu página ahora", icon: Sparkles, color: "text-sky-300 bg-sky-400/10" },
    { label: "Tu oferta", value: loaded ? profile ? "Publicada" : "Por crear" : "—", detail: profile ? `${money(profile.price_cents)} USDC / ${profile.duration_days} días` : "Un espacio exclusivo para marcas", icon: LayoutTemplate, color: "text-amber-200 bg-amber-300/10" },
  ];

  return <div className="min-h-screen bg-[#07070a] text-white">
    <Sidebar creatorAlias={profile?.alias} />
    <main id="main-content" tabIndex={-1} className="min-w-0 px-5 py-7 sm:px-8 lg:ml-64 lg:px-10 lg:py-9 xl:px-12"><div className="mx-auto max-w-7xl">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-white/10 pb-7"><div><p className="text-xs font-medium uppercase tracking-[.2em] text-zinc-400">Tu espacio de creador</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Resumen</h1></div><SponsorshipWalletControl /></header>
      <CreatorTipSummary />
      <section className="relative mt-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#182c26] via-[#12171c] to-[#20152f] p-7 sm:p-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full border-[50px] border-[#00F5A0]/5 sm:right-0" />
        <div className="relative max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full border border-[#00F5A0]/20 bg-[#00F5A0]/5 px-3 py-1 text-xs text-[#9cfbd4]"><span className="size-1.5 rounded-full bg-[#00F5A0]" />Solana devnet · modo de prueba</span><h2 className="mt-6 break-words text-3xl font-semibold tracking-tight sm:text-5xl">{profile ? `Hola, ${profile.display_name}.` : "Tu comunidad. Tu próximo paso."}</h2><p className="mt-4 max-w-lg text-sm leading-7 text-zinc-300 sm:text-base">{profile ? "Tu oferta ya tiene un lugar. Revisa las propuestas y elige qué marcas quieres compartir con tu comunidad." : "Convierte tu espacio en una oportunidad para colaborar. Crea tu oferta y deja que las marcas te encuentren."}</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/dashboard/sponsorships" className={primary}>{profile ? "Gestionar patrocinios" : "Crear mi primera oferta"}<ArrowUpRight size={17} aria-hidden="true" /></Link><Link href="/dashboard/card" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-medium hover:bg-white/5">Personalizar mi página<ArrowRight size={16} aria-hidden="true" /></Link></div></div>
      </section>
      <div className="mb-4 mt-9 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Tus patrocinios, de un vistazo</h2><button type="button" disabled={!wallet || busy} onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/5 disabled:opacity-40"><RefreshCw size={14} aria-hidden="true" className={busy ? "animate-spin motion-reduce:animate-none" : ""} />{busy ? "Cargando…" : loaded ? "Actualizar resumen" : "Cargar resumen"}</button></div>
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({ label, value, detail, icon: Icon, color }) => <section key={label} className={`${panel} p-5`}><div className="flex items-center justify-between gap-2"><h3 className="text-xs font-normal text-zinc-400">{label}</h3><span className={`rounded-lg p-2 ${color}`}><Icon size={17} aria-hidden="true" /></span></div><p className="mt-5 break-words text-2xl font-semibold tracking-tight">{value}</p><p className="mt-2 text-xs leading-5 text-zinc-400">{detail}</p></section>)}</div>
      {!loaded && <p role="status" className="mt-3 text-xs leading-5 text-zinc-400">{busy ? "Cargando tu resumen…" : wallet ? "Carga tu resumen con una firma de wallet para ver tus campañas. Esta firma no transfiere fondos." : "Conecta tu wallet y carga el resumen para ver tus datos."}</p>}
      {loaded && campaigns.length === 100 && <p className="mt-3 text-xs text-zinc-400">El resumen incluye tus últimas 100 campañas.</p>}
      <div className="mt-8 grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <section className={`${panel} p-6 sm:p-7`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Últimas campañas</h2><Link href="/dashboard/sponsorships" className="flex items-center gap-1 text-xs text-[#00F5A0]">Ver todas<ArrowUpRight size={15} aria-hidden="true" /></Link></div>
          {busy && !loaded ? <LoadingState label="Cargando tus campañas…" /> : campaigns.length ? <ul className="mt-5 divide-y divide-white/5">{campaigns.slice(0, 5).map(c => <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="break-words text-sm font-medium">{c.brand_name}</p><p className="mt-1 text-xs text-zinc-400">{c.creator_wallet === wallet ? "Propuesta recibida" : "Tu propuesta"} · {c.duration_days} días</p></div><div className="text-right"><p className="text-sm font-medium">{money(c.price_cents)} USDC</p><p className="mt-1 text-xs text-zinc-400">{c.status === "active" && !isLive(c) ? "Finalizada" : statusLabels[c.status]}</p></div></li>)}</ul> : <div className="flex min-h-64 flex-col items-center justify-center px-3 py-8 text-center"><span className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-zinc-400"><Inbox size={26} aria-hidden="true" /></span><h3 className="text-base font-medium">{loaded ? "Aquí empieza tu próxima colaboración" : "Tus colaboraciones, en un solo lugar"}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-zinc-400">{loaded ? "Cuando una marca envíe una propuesta, podrás revisarla desde tu panel de patrocinios." : "Carga tu resumen para consultar propuestas, pagos y campañas publicadas."}</p><Link href="/dashboard/sponsorships" className="mt-5 text-sm text-violet-300">Ir a patrocinios →</Link></div>}
        </section>
        <section className={`${panel} p-6 sm:p-7`}><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Prepara tu espacio</h2><span className="text-xs text-zinc-400">{steps.filter(s => s.done).length} / 3</span></div><ol className="mt-6 space-y-6">{steps.map((s, index) => <li key={s.label} className="flex gap-3"><span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs ${s.done ? "bg-[#00F5A0]/10 text-[#00F5A0]" : "border border-white/15 text-zinc-400"}`}>{s.done ? <Check size={14} aria-label="Completado" /> : index + 1}</span><div><p className="text-sm font-medium">{s.label}</p><p className="mt-1 text-xs leading-5 text-zinc-400">{s.description}</p></div></li>)}</ol><div className="mt-7 border-t border-white/10 pt-5">{!wallet ? <button onClick={open} className={`${primary} w-full`}>Conectar mi wallet<Wallet size={16} aria-hidden="true" /></button> : !loaded ? <button disabled={busy} onClick={() => void refresh()} className={`${primary} w-full disabled:opacity-40`}>{busy ? "Cargando…" : "Cargar mi resumen"}<ArrowRight size={16} aria-hidden="true" /></button> : <Link href="/dashboard/sponsorships" className={`${primary} w-full`}>{profile ? "Revisar mi oferta" : "Publicar mi oferta"}<ArrowRight size={16} aria-hidden="true" /></Link>}</div></section>
      </div>
      <section className="mt-6 flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-violet-400/20 bg-violet-400/5 p-6"><div><h2 className="font-medium">Tu página, lista para compartir</h2><p className="mt-1 break-all text-sm text-zinc-400">{profile ? `/creators/${profile.alias}` : "Publica tu oferta para obtener tu enlace de creador."}</p></div><div className="flex flex-wrap items-center gap-3">{profile ? <><button onClick={() => void copyPage()} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm hover:bg-white/5"><Copy size={15} aria-hidden="true" />Copiar enlace</button><Link href={`/creators/${profile.alias}`} className="inline-flex items-center gap-2 px-2 py-2.5 text-sm text-violet-300">Ver mi página<ArrowUpRight size={16} aria-hidden="true" /></Link></> : <Link href="/dashboard/sponsorships" className="inline-flex items-center gap-2 text-sm text-violet-300">Crear mi enlace<ArrowUpRight size={16} aria-hidden="true" /></Link>}</div></section>
      {copyNotice && <p role="status" className="mt-3 text-sm text-zinc-400">{copyNotice}</p>}
      <footer className="flex flex-wrap justify-between gap-2 py-8 text-xs text-zinc-400"><p>Hecho para creadores. Construido sobre Solana.</p><p>Los pagos de esta versión usan tokens de prueba.</p></footer>
    </div></main>
  </div>;
}
