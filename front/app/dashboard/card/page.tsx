"use client";
import CreatorOfferSelection from "@/components/CreatorOfferSelection";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight, Check, Eye, ImagePlus, Link2, Monitor, Plus, Save, Smartphone, Trash2, UserRound } from 'lucide-react';
import { WalletAuthGate } from '@/components/WalletAuthGate';
import { Sidebar } from '@/components/Sidebar';
import { DRAFT_KEY, EMPTY_DRAFT, draftFromProfile, readDraft, safeLink, validateDraft, type CreatorDraft } from '@/lib/creator-draft';
import { useWalletSession } from '@/components/WalletSessionProvider';
import { useClaimedAlias } from '@/lib/use-claimed-alias';
import SponsorshipWalletControl from '@/components/SponsorshipWalletControl';

const subscribe = () => () => {};
const field = 'mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#00F5A0]';
const secondary = 'inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5 disabled:opacity-40';
const accents = { mint: '#00F5A0', violet: '#b69aff', rose: '#ff94b9' };
const tabs = ['Perfil', 'Apariencia', 'Enlaces', 'Redes', 'Ofertas'] as const;

function initialDraft(wallet: string) {
  try { return { draft: readDraft(localStorage.getItem(`${DRAFT_KEY}:${wallet}`)), error: '' }; }
  catch { return { draft: structuredClone(EMPTY_DRAFT), error: 'No se pudo recuperar el borrador. Puedes editar uno nuevo; el guardado anterior se conserva hasta que guardes.' }; }
}

export default function MyPagePage() {
  const { wallet, checking } = useWalletSession();
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  return <div className="min-h-screen bg-[#07070a] text-white"><Sidebar /><main className="min-w-0 px-4 py-5 sm:px-8 lg:ml-64 lg:px-10 lg:py-9">{!ready || checking ? <p role="status" className="text-zinc-400">Cargando tu editor…</p> : wallet ? <CreatorEditor key={wallet} /> : <section className="rounded-2xl border border-white/10 p-6"><p className="mb-4 text-sm text-zinc-400">Inicia sesión con la wallet seleccionada para editar su perfil.</p><WalletAuthGate /></section>}</main></div>;
}

function CreatorEditor() {
  const { wallet, ensureSession } = useWalletSession();
  const claimed = useClaimedAlias(wallet);
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [published, setPublished] = useState(false);
  const [tipsEnabled, setTipsEnabled] = useState(true);
  const [savedTipsEnabled, setSavedTipsEnabled] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [initial] = useState(() => initialDraft(wallet));
  const storageKey = `${DRAFT_KEY}:${wallet}`;
  const [localDraft, setDraft] = useState(initial.draft);
  const draft = claimed.alias ? { ...localDraft, alias: claimed.alias } : localDraft;
  const [saved, setSaved] = useState(initial.draft);
  const [tab, setTab] = useState<typeof tabs[number]>('Perfil');
  const [notice, setNotice] = useState(initial.error);
  const [failed, setFailed] = useState(!!initial.error);
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [imageBusy, setImageBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const uploads = useRef<Record<'avatar' | 'cover', number>>({ avatar: 0, cover: 0 });
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved) || tipsEnabled !== savedTipsEnabled;
  useEffect(() => {
    const controller = new AbortController();
    if (!wallet) return;
    fetch('/api/profile', { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result.profile; })
      .then(profile => {
        if (controller.signal.aborted || !profile) return;
        const design = draftFromProfile({ ...profile, alias: profile.username, display_name: profile.display_name || profile.username, bio: profile.bio || '' });
        setDraft(design); setSaved(design); setPublished(profile.published); setTipsEnabled(profile.tips_enabled); setSavedTipsEnabled(profile.tips_enabled); setProfileLoaded(true);
      })
      .catch(reason => { if (!controller.signal.aborted) { setFailed(true); setNotice(reason instanceof Error ? reason.message : 'No se pudo cargar tu perfil.'); } });
    return () => controller.abort();
  }, [wallet]);
  const accent = accents[draft.accent];
  const walletRef = useRef(wallet);
  useEffect(() => { walletRef.current = wallet; }, [wallet]);

  async function loadPublished() {
    setRemoteBusy(true); setNotice(''); setFailed(false);
    try {
      const response = await fetch('/api/profile', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (walletRef.current !== wallet) throw new Error('La wallet cambió. Carga el perfil de la cuenta actual.');
      const profile = result.profile;
      const design = profile ? draftFromProfile({ ...profile, alias: profile.username, display_name: profile.display_name || profile.username, bio: profile.bio || '' }) : null;
      if (design) { setDraft(design); setSaved(design); setPublished(profile.published); setTipsEnabled(profile.tips_enabled); setSavedTipsEnabled(profile.tips_enabled); }
      setProfileLoaded(true);
      setNotice(design ? 'Perfil guardado cargado desde Supabase.' : 'Compra tu alias para editar tu página.');
    } catch (reason) { setFailed(true); setNotice(reason instanceof Error ? reason.message : 'No se pudo cargar tu perfil.'); }
    finally { setRemoteBusy(false); }
  }

  async function publish(makePublic = true) {
    if (claimed.loading || claimed.error) { setFailed(true); setNotice('Espera a que se verifique el alias de tu wallet antes de publicar.'); return; }
    const error = validateDraft(draft);
    if (error) { setFailed(true); setNotice(error); return; }
    if (!wallet) { setFailed(true); setNotice('Conecta tu wallet para guardar y publicar tu página.'); return; }
    setRemoteBusy(true); setNotice(''); setFailed(false);
    try {
      if (await ensureSession() !== wallet) throw new Error('La sesión pertenece a otra wallet. Carga el perfil actual.');
      const response = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ design: draft, published: makePublic, tips_enabled: tipsEnabled }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setPublished(makePublic); setSavedTipsEnabled(tipsEnabled);
      if (walletRef.current !== wallet) throw new Error('La wallet cambió. La publicación se autorizó con la cuenta anterior; carga su perfil para comprobarla.');
      const published = readDraft(JSON.stringify(result.profile.design));
      setDraft(published); setSaved(published);
      try { localStorage.setItem(storageKey, JSON.stringify(published)); setSaved(published); }
      catch { setNotice('Perfil guardado en Supabase. No se pudo guardar el respaldo local; puedes recuperarlo desde tu perfil.'); return; }
      setNotice(makePublic ? 'Diseño publicado. Tu página pública ya muestra tus imágenes, enlaces y apariencia.' : 'Perfil guardado en Supabase. Tu página pública está oculta.');
    } catch (reason) { setFailed(true); setNotice(reason instanceof Error ? reason.message : 'No se pudo publicar. Tu borrador se conserva.'); }
    finally { setRemoteBusy(false); }
  }

  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = ''; }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function update<K extends keyof CreatorDraft>(key: K, value: CreatorDraft[K]) {
    setDraft(previous => ({ ...previous, [key]: value })); setNotice('');
  }
  function save() {
    const normalized = { ...draft, name: draft.name.trim(), bio: draft.bio.trim(), links: draft.links.map(link => ({ ...link, title: link.title.trim(), url: link.url.trim() })), socials: Object.fromEntries(Object.entries(draft.socials).map(([key, value]) => [key, value.trim()])) as CreatorDraft['socials'] };
    const error = validateDraft(normalized);
    if (error) { setFailed(true); setNotice(error); return; }
    try { localStorage.setItem(storageKey, JSON.stringify(normalized)); setDraft(normalized); setSaved(normalized); setFailed(false); setNotice('Borrador guardado en este navegador. Tu página pública todavía no se modificó.'); }
    catch { setFailed(true); setNotice('No se pudo guardar. El almacenamiento puede estar lleno o bloqueado. Tus cambios siguen en el editor; prueba con imágenes más pequeñas.'); }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>, key: 'avatar' | 'cover') {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) {
      setFailed(true); setNotice('Selecciona un archivo JPG, PNG o WebP de hasta 1 MB.'); return;
    }
    const version = ++uploads.current[key];
    setImageBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const tooLarge = bitmap.width > 6000 || bitmap.height > 6000;
      bitmap.close();
      if (tooLarge) throw new Error();
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
      });
      if (uploads.current[key] === version) { update(key, data); setFailed(false); }
    } catch { setFailed(true); setNotice('No se pudo abrir la imagen. Usa una imagen válida de hasta 6000 píxeles por lado.'); }
    finally { setImageBusy(false); }
  }
  function reorder(index: number, offset: number) {
    const links = [...draft.links]; [links[index], links[index + offset]] = [links[index + offset], links[index]]; update('links', links);
  }
  function clearDraft() {
    try {
      localStorage.removeItem(storageKey);
      const empty = structuredClone(EMPTY_DRAFT);
      setDraft(empty); setSaved(empty); setConfirmReset(false); setFailed(false);
      setNotice('Borrador local eliminado. Puedes empezar de nuevo.');
    } catch { setFailed(true); setNotice('No se pudo eliminar el borrador guardado. Reintenta.'); }
  }

  return <div className="mx-auto max-w-7xl [&_button]:touch-manipulation">
    <Link href="/dashboard/products" className="mb-5 inline-flex w-full items-center justify-center gap-2 sm:w-auto rounded-xl border border-violet-400/30 bg-violet-400/10 px-4 py-3 text-sm font-medium text-violet-200">Mis productos · Tickets NFT y suscripciones<ArrowUpRight size={16} aria-hidden="true" /></Link>
    <header className="flex flex-wrap items-center justify-between gap-5 border-b border-white/10 pb-7"><div><p className="text-xs uppercase tracking-[.2em] text-zinc-500">Tu espacio de creador</p><h1 className="mt-2 text-2xl font-semibold">Mi página</h1><p className="mt-2 text-sm text-zinc-400">Dale tu identidad. Mira los cambios mientras editas.</p></div><div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center"><span role="status" className={`text-xs ${dirty ? 'text-amber-200' : 'text-zinc-500'}`}>{dirty ? 'Cambios sin guardar' : 'Sin cambios pendientes'}</span><button onClick={() => void publish()} disabled={imageBusy || remoteBusy || !wallet || !profileLoaded || claimed.loading || !!claimed.error} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl sm:w-auto bg-violet-400 px-5 py-3 text-sm font-semibold text-black hover:bg-violet-300 disabled:opacity-40"><Save size={16} aria-hidden="true" />{remoteBusy ? 'Guardando…' : 'Guardar y publicar'}</button><button onClick={save} disabled={imageBusy || remoteBusy} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl sm:w-auto bg-[#00F5A0] px-5 py-3 text-sm font-semibold text-black hover:bg-[#8affd6] disabled:opacity-40"><Save size={16} aria-hidden="true" />Guardar borrador local</button><SponsorshipWalletControl fullWidthOnMobile /></div></header>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-400/20 bg-violet-400/5 px-4 py-3"><p className="text-xs leading-5 text-violet-200">Edita tu borrador y pulsa Guardar y publicar para guardar en Supabase. También puedes guardar un respaldo local.</p><Link href="/dashboard/sponsorships" className="inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-xl border border-violet-400/20 px-4 py-3 text-xs text-violet-300 sm:w-auto">Gestionar patrocinios<ArrowUpRight size={14} aria-hidden="true" /></Link></div>
    {claimed.loading && <p role="status" className="mt-4 text-xs text-zinc-400">Consultando el alias de tu wallet…</p>}{claimed.error && <p role="alert" className="mt-4 text-xs text-red-200">{claimed.error} <button type="button" onClick={claimed.retry} className="underline">Reintentar</button></p>}
    {notice && <p role={failed ? 'alert' : 'status'} className={`mt-4 rounded-xl border p-4 text-sm ${failed ? 'border-red-400/20 text-red-200' : 'border-[#00F5A0]/20 text-emerald-200'}`}>{notice}</p>}
    <section className="mt-5 rounded-2xl border border-white/10 bg-[#101015] p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-sm font-semibold">Tu página pública</h2><p className="mt-2 text-xs leading-6 text-zinc-500">{published ? 'Tu página está publicada. Guarda y publica para actualizarla.' : 'Guarda y publica cuando tu página esté lista.'}</p></div><div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center"><button disabled={remoteBusy || imageBusy || dirty} onClick={() => void loadPublished()} className={secondary}>Recargar mi perfil guardado</button><button disabled={remoteBusy || imageBusy || !profileLoaded} onClick={() => void publish(false)} className={secondary}>Guardar sin publicar</button>{published && <Link href={`/${draft.alias}`} className="flex min-h-11 w-full items-center justify-center rounded-xl border border-white/15 px-4 py-3 text-xs text-violet-300 sm:w-auto">Ver página pública ↗</Link>}</div></div></section>
    <div className="mt-4 text-xs text-zinc-500">{confirmReset ? <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-400/20 p-4"><p>Se eliminarán el borrador guardado y los cambios del editor.</p><button disabled={imageBusy || remoteBusy} onClick={clearDraft} className="min-h-11 w-full rounded-lg px-3 py-2 sm:w-auto text-red-300 disabled:opacity-40">Eliminar borrador</button><button onClick={() => setConfirmReset(false)} className="min-h-11 w-full rounded-lg px-3 py-2 sm:w-auto text-zinc-300">Cancelar</button></div> : <button disabled={imageBusy || remoteBusy} onClick={() => setConfirmReset(true)} className="min-h-11 w-full rounded-lg border border-white/10 px-3 py-2 sm:w-auto hover:text-zinc-300 disabled:opacity-40">Empezar de nuevo</button>}</div>
    <div className="mt-7 grid min-w-0 gap-7 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section className="min-w-0 rounded-2xl border border-white/10 bg-[#101015]">
        <div role="group" aria-label="Secciones del editor" className="grid grid-cols-1 gap-1 border-b sm:grid-cols-5 border-white/10 p-3">{tabs.map(item => <button key={item} aria-pressed={tab === item} onClick={() => setTab(item)} className={`rounded-lg px-1 py-3 text-xs font-medium transition sm:text-sm ${tab === item ? 'bg-[#00F5A0]/10 text-[#00F5A0]' : 'text-zinc-400 hover:bg-white/5'}`}>{item}</button>)}</div>
        <fieldset disabled={remoteBusy || !profileLoaded} className="min-w-0 space-y-6 p-4 disabled:opacity-60 sm:p-7">
          {tab === 'Ofertas' && <CreatorOfferSelection />}
          {tab === 'Perfil' && <><p className="text-xs text-zinc-500">{published ? 'Página publicada' : 'Página sin publicar'}</p><label className="flex items-center gap-3 text-sm text-zinc-300"><input type="checkbox" checked={tipsEnabled} onChange={event => setTipsEnabled(event.target.checked)} />Recibir propinas en USDC y SOL</label><div><h2 className="text-lg font-semibold">La persona detrás de tu página</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Un nombre, una historia y un lugar para tu comunidad.</p></div>
            <label className="block text-sm text-zinc-300">Alias<input aria-label="Alias" value={draft.alias} readOnly={!!claimed.alias} disabled={claimed.loading || !!claimed.error} maxLength={30} onChange={e => update('alias', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="tu_alias" className={field} /><span className="mt-2 block break-all text-xs text-zinc-500">{claimed.alias ? 'Alias comprado por tu wallet:' : 'Alias propuesto:'} @{draft.alias || 'tu_alias'}{!claimed.alias && ' · disponibilidad pendiente'}</span></label>
            <label className="block text-sm text-zinc-300">Nombre de creador<input value={draft.name} maxLength={60} onChange={e => update('name', e.target.value)} placeholder="¿Cómo te conoce tu comunidad?" className={field} /></label>
            <label className="block text-sm text-zinc-300">Presentación<textarea value={draft.bio} maxLength={280} rows={4} onChange={e => update('bio', e.target.value)} placeholder="Cuenta qué creas y qué te inspira…" className={`${field} resize-y`} /><span className="mt-2 block text-right text-xs text-zinc-500">{draft.bio.length} / 280</span></label>
            {(['avatar'] as const).map(key => <div key={key} className="rounded-xl border border-white/10 p-4"><h3 className="text-sm font-medium">Foto de perfil</h3><div className="mt-3 flex flex-wrap items-center gap-4"><div className={`relative shrink-0 overflow-hidden bg-white/5 ${key === 'avatar' ? 'size-16 rounded-full' : 'h-16 w-28 rounded-lg'}`}>{draft[key] ? <Image src={draft[key]} alt={key === 'avatar' ? 'Foto de perfil seleccionada' : 'Portada seleccionada'} fill unoptimized sizes="112px" className="object-cover" /> : <div className="flex h-full items-center justify-center text-zinc-500"><ImagePlus size={23} aria-hidden="true" /></div>}</div><div className="w-full min-w-0 sm:w-auto"><label className={`${secondary} cursor-pointer focus-within:outline-2 focus-within:outline-[#00F5A0]`}>Elegir imagen<input type="file" aria-label={key === 'avatar' ? 'Subir foto de perfil' : 'Subir portada'} accept="image/png,image/jpeg,image/webp" disabled={imageBusy || remoteBusy} className="sr-only" onChange={e => void upload(e, key)} /></label>{draft[key] && <button disabled={imageBusy || remoteBusy} onClick={() => update(key, '')} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 text-xs text-zinc-400 sm:ml-3 sm:mt-0 sm:w-auto sm:px-4">Quitar</button>}<p className="mt-2 text-xs text-zinc-500">JPG, PNG o WebP · hasta 1 MB</p></div></div></div>)}
          </>}
          {tab === 'Apariencia' && <><div><h2 className="text-lg font-semibold">Una página que se sienta tuya</h2><p className="mt-2 text-sm text-zinc-500">Elige el tono de tu espacio.</p></div><fieldset><legend className="text-sm text-zinc-300">Color de acento</legend><div className="mt-3 flex flex-wrap gap-3">{(Object.keys(accents) as Array<keyof typeof accents>).map(color => <label key={color} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm ${draft.accent === color ? 'border-white/40' : 'border-white/10'}`}><input type="radio" name="accent" checked={draft.accent === color} onChange={() => update('accent', color)} className="sr-only peer" /><span className="size-5 rounded-full peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4" style={{background: accents[color]}} />{color === 'mint' ? 'Menta' : color === 'violet' ? 'Violeta' : 'Rosa'}{draft.accent === color && <Check size={14} aria-hidden="true" />}</label>)}</div></fieldset><fieldset><legend className="text-sm text-zinc-300">Fondo de la página</legend><div className="mt-3 grid grid-cols-2 gap-3">{(['dark','light'] as const).map(theme => <label key={theme} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 p-4 text-sm"><input type="radio" name="theme" checked={draft.theme === theme} onChange={() => update('theme', theme)} />{theme === 'dark' ? 'Oscuro' : 'Claro'}</label>)}</div></fieldset><label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 p-4 text-sm">Botones redondeados<input type="checkbox" checked={draft.rounded} onChange={e => update('rounded', e.target.checked)} className="size-4 accent-emerald-400" /></label></>}
          {tab === 'Enlaces' && <><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Lo que quieres compartir</h2><p className="mt-2 text-sm text-zinc-500">Hasta 8 enlaces. Elige su orden.</p></div><button disabled={draft.links.length >= 8} onClick={() => update('links', [...draft.links, {id: crypto.randomUUID(), title:'', url:''}])} className={secondary}><Plus size={16} aria-hidden="true" />Agregar enlace</button></div>{!draft.links.length && <div className="rounded-xl border border-dashed border-white/15 p-7 text-center text-sm leading-6 text-zinc-500">Tu sitio, tu último video o tu proyecto favorito.<br />Agrega tu primer enlace para verlo en la vista previa.</div>}{draft.links.map((link,index) => <div key={link.id} className="space-y-3 rounded-xl border border-white/10 p-4"><div className="flex items-center justify-between"><p className="text-xs text-zinc-500">Enlace {index + 1}</p><div className="flex gap-1">{[{label:'Subir', icon:ArrowUp, offset:-1, disabled:index === 0}, {label:'Bajar', icon:ArrowDown, offset:1, disabled:index === draft.links.length - 1}].map(({label,icon:Icon,offset,disabled}) => <button key={label} aria-label={`${label} enlace ${index + 1}`} disabled={disabled} onClick={() => reorder(index,offset)} className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 disabled:opacity-25"><Icon size={16} /></button>)}<button aria-label={`Eliminar enlace ${index + 1}`} onClick={() => update('links', draft.links.filter(item => item.id !== link.id))} className="rounded-lg p-2 text-red-300 hover:bg-red-400/10"><Trash2 size={16} /></button></div></div><label className="block text-xs text-zinc-400">Título del enlace {index + 1}<input value={link.title} maxLength={60} placeholder="Mi último video" onChange={e => update('links', draft.links.map(item => item.id === link.id ? {...item,title:e.target.value} : item))} className={field} /></label><label className="block text-xs text-zinc-400">URL del enlace {index + 1}<input value={link.url} type="url" maxLength={500} placeholder="https://…" onChange={e => update('links', draft.links.map(item => item.id === link.id ? {...item,url:e.target.value} : item))} className={field} /></label></div>)}</>}
          {tab === 'Redes' && <><div><h2 className="text-lg font-semibold">Conecta con tu comunidad</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Agrega el enlace completo de tus perfiles. Deja vacío lo que no quieras mostrar.</p></div>{(['instagram','youtube','x'] as const).map(network => <label key={network} className="block text-sm text-zinc-300">{network === 'x' ? 'X' : network === 'youtube' ? 'YouTube' : 'Instagram'}<input value={draft.socials[network]} type="url" maxLength={500} placeholder={`https://${network === 'x' ? 'x' : network}.com/tu_perfil`} onChange={e => update('socials', {...draft.socials,[network]:e.target.value})} className={field} /></label>)}</>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5"><p className="text-xs text-zinc-500">La vista previa cambia al instante.</p><button disabled={!dirty || imageBusy} onClick={() => { uploads.current.avatar++; uploads.current.cover++; setTipsEnabled(savedTipsEnabled); setDraft(structuredClone(saved)); setNotice('Volviste al último borrador guardado.'); setFailed(false); }} className="min-h-11 w-full rounded-xl border border-white/10 px-4 py-3 text-xs text-zinc-400 hover:text-white disabled:opacity-30 sm:w-auto">Descartar cambios</button></div>
        </fieldset>
      </section>
      <aside className="min-w-0 self-start xl:sticky xl:top-7"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><Eye size={16} aria-hidden="true" />Vista previa</h2><p className="mt-1 text-xs text-zinc-500">Vista previa de tus cambios</p></div><div className="flex gap-1 rounded-lg border border-white/10 p-1"><button aria-label="Vista previa móvil" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')} className={`rounded-md p-2 ${device === 'mobile' ? 'bg-white/10 text-white' : 'text-zinc-500'}`}><Smartphone size={16} /></button><button aria-label="Vista previa de escritorio" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')} className={`rounded-md p-2 ${device === 'desktop' ? 'bg-white/10 text-white' : 'text-zinc-500'}`}><Monitor size={16} /></button></div></div>
        <Link href="/dashboard/card/preview" target="_blank" rel="noopener noreferrer" className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-xs text-violet-300">Ver borrador guardado como página completa<ArrowUpRight size={14} /></Link>
        {dirty && <p className="mb-4 text-center text-xs text-amber-200">Guarda tus cambios antes de abrir la página completa.</p>}
        <div className={`mx-auto overflow-hidden rounded-3xl border border-white/15 shadow-2xl transition-[max-width] ${device === 'mobile' ? 'max-w-[340px]' : 'max-w-full'} ${draft.theme === 'dark' ? 'bg-[#101015] text-white' : 'bg-[#f5f5f7] text-zinc-900'}`}>
          <div className="relative h-32" style={{background:`linear-gradient(135deg, ${accent}66, #3c245b)`}}></div>
          <div className="relative -mt-10 flex flex-col items-center px-6 pb-7"><div className={`relative size-20 overflow-hidden rounded-full border-4 ${draft.theme === 'dark' ? 'border-[#101015] bg-zinc-800' : 'border-[#f5f5f7] bg-zinc-200'}`}>{draft.avatar ? <Image src={draft.avatar} alt="Avatar de la vista previa" fill sizes="80px" unoptimized className="object-cover" /> : <div className="flex h-full items-center justify-center text-zinc-500"><UserRound size={30} aria-hidden="true" /></div>}</div><h3 className="mt-4 max-w-full break-words text-center text-xl font-semibold">{draft.name || 'Tu nombre de creador'}</h3><p className="mt-1 break-all text-xs opacity-50">@{draft.alias || 'tu_alias'}</p><p className="mt-4 w-full whitespace-pre-line break-words text-center text-sm leading-6 opacity-70">{draft.bio || 'Tu historia empieza aquí. Cuenta lo que te gusta crear.'}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">{Object.entries(draft.socials).filter(([,url]) => safeLink(url)).map(([network,url]) => <a key={network} href={safeLink(url)!} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${network}`} className="rounded-full border border-current/15 px-3 py-2 text-xs opacity-70 hover:opacity-100">{network === 'x' ? 'X' : network === 'youtube' ? 'YouTube' : 'Instagram'}</a>)}</div>
          <div className="mt-5 w-full space-y-3">{draft.links.map(link => { const url = safeLink(link.url); const content = <><Link2 size={16} aria-hidden="true" className="shrink-0" /><span className="min-w-0 flex-1 break-words text-center">{link.title || 'Título de tu enlace'}</span><ArrowUpRight size={15} aria-hidden="true" className="shrink-0" /></>; const className = `flex items-center gap-2 border px-4 py-3 text-sm font-medium ${draft.rounded ? 'rounded-2xl' : 'rounded-md'}`; return url ? <a key={link.id} href={url} target="_blank" rel="noopener noreferrer" className={className} style={{borderColor:accent+'66',background:accent+'15'}}>{content}</a> : <div key={link.id} className={`${className} opacity-40`} style={{borderColor:accent+'66'}}>{content}</div>; })}{!draft.links.length && <div className="rounded-xl border border-dashed border-current/15 p-5 text-center text-xs leading-5 opacity-40">Tus enlaces aparecerán aquí.</div>}</div><p className="mt-8 text-[10px] tracking-widest opacity-40">CREADO CON VYNX<span style={{color:accent}}>.</span></p></div>
        </div><p className="mx-auto mt-4 max-w-sm text-center text-xs leading-5 text-zinc-500">Los enlaces HTTPS válidos se pueden abrir desde la vista previa.</p>
      </aside>
    </div>
  </div>;
}


