"use client";
import { ArrowUpRight } from 'lucide-react';
import { PublicCreatorCard } from '@/components/PublicCreatorCard';
import { UserFacingError, userErrorMessage, responseError } from '@/lib/user-facing-error';
import CreatorOfferSelection from "@/components/CreatorOfferSelection";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent } from 'react';
import { ArrowDown, ArrowUp, Check, Eye, ImagePlus, Monitor, Plus, Save, Smartphone, Trash2 } from '@/components/CardIcons';
import { WalletAuthGate } from '@/components/WalletAuthGate';
import { Sidebar } from '@/components/Sidebar';
import { DRAFT_KEY, EMPTY_DRAFT, draftFromProfile, readDraft, safeLink, validateDraft, type CreatorDraft } from '@/lib/creator-draft';
import { useWalletSession } from '@/components/WalletSessionProvider';
import { useClaimedAlias } from '@/lib/use-claimed-alias';
import SponsorshipWalletControl from '@/components/SponsorshipWalletControl';
import { LoadingState } from '@/components/LoadingState';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Instagram, Youtube } from '@/components/CardIcons';

const socialLabels = { instagram: 'Instagram', youtube: 'YouTube', x: 'X' };
function SocialIcon({ network }: { network: string }) {
  return network === 'instagram' ? <Instagram size={20} /> : network === 'youtube' ? <Youtube size={20} /> : <span aria-hidden="true" className="text-lg font-semibold">𝕏</span>;
}
const subscribe = () => () => {};
const field = 'mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-[#00F5A0]';
const secondary = 'inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5 disabled:opacity-70';
const accents = { mint: '#00F5A0', violet: '#b69aff', rose: '#ff94b9' };
const tabs = ["Profile", "Appearance", "Links", "Socials", "Offers"] as const;

function initialDraft(wallet: string) {
  try { return { draft: readDraft(localStorage.getItem(`${DRAFT_KEY}:${wallet}`)), error: '' }; }
  catch { return { draft: structuredClone(EMPTY_DRAFT), error: "Could not recover the draft. You can edit a new one; the previous draft is preserved until you save." }; }
}

export default function MyPagePage() {
  const { wallet, checking } = useWalletSession();
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  if (ready && !checking && !wallet) return <WalletAuthGate />;
  return <div className="dark min-h-screen bg-[#07070a] text-white"><Sidebar /><main id="main-content" tabIndex={-1} className="min-w-0 px-4 py-3 sm:px-8 lg:ml-64 lg:px-10 lg:py-4">{!ready || checking ? <p role="status" className="text-zinc-400">Loading your editor…</p> : <CreatorEditor key={wallet} />}</main></div>;
}

function CreatorEditor() {
  const { wallet, ensureSession } = useWalletSession();
  const claimed = useClaimedAlias(wallet);
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [published, setPublished] = useState(false);
  const [tipsEnabled, setTipsEnabled] = useState(true);
  const [showPayerAddresses, setShowPayerAddresses] = useState(false);
  const [savedShowPayerAddresses, setSavedShowPayerAddresses] = useState(false);
  const [savedTipsEnabled, setSavedTipsEnabled] = useState(true);
  const [profileStatus, setProfileStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const profileLoaded = profileStatus === 'ready';
  const [initial] = useState(() => initialDraft(wallet));
  const storageKey = `${DRAFT_KEY}:${wallet}`;
  const [localDraft, setDraft] = useState(initial.draft);
  const draft = claimed.alias ? { ...localDraft, alias: claimed.alias } : localDraft;
  const [saved, setSaved] = useState(initial.draft);
  const [tab, setTab] = useState<typeof tabs[number]>("Profile");
  const [notice, setNotice] = useState(initial.error);
  const [failed, setFailed] = useState(!!initial.error);
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [imageBusy, setImageBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const resetButton = useRef<HTMLButtonElement>(null);
  const uploads = useRef<Record<'avatar' | 'cover', number>>({ avatar: 0, cover: 0 });
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved) || tipsEnabled !== savedTipsEnabled || showPayerAddresses !== savedShowPayerAddresses;
  useEffect(() => {
    const controller = new AbortController();
    if (!wallet) return;
    fetch('/api/profile', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]), cache: 'no-store' })
      .then(async response => { const result = await response.json(); if (!response.ok) throw responseError(response, result, 'Unable to complete the request. Please retry.'); return result.profile; })
      .then(profile => {
        if (controller.signal.aborted) return;
        if (!profile) { setProfileStatus('empty'); return; }
        const design = draftFromProfile({ ...profile, alias: profile.username, display_name: profile.display_name || profile.username, bio: profile.bio || '' });
        setDraft(design); setSaved(design); setPublished(profile.published); setTipsEnabled(profile.tips_enabled); setSavedTipsEnabled(profile.tips_enabled); setShowPayerAddresses(profile.show_payer_addresses === true); setSavedShowPayerAddresses(profile.show_payer_addresses === true); setProfileStatus('ready');
      })
      .catch(reason => { if (!controller.signal.aborted) { setProfileStatus('error'); setFailed(true); setNotice(userErrorMessage(reason, "Could not load your profile.")); } });
    return () => controller.abort();
  }, [wallet]);
  const walletRef = useRef(wallet);
  useEffect(() => { walletRef.current = wallet; }, [wallet]);

  async function loadPublished() {
    setRemoteBusy(true); setNotice(''); setFailed(false);
    try {
      const response = await fetch('/api/profile', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw responseError(response, result, 'Unable to complete the request. Please retry.');
      if (walletRef.current !== wallet) throw new UserFacingError("The wallet changed. Load the current account profile.");
      const profile = result.profile;
      const design = profile ? draftFromProfile({ ...profile, alias: profile.username, display_name: profile.display_name || profile.username, bio: profile.bio || '' }) : null;
      if (design) { setDraft(design); setSaved(design); setPublished(profile.published); setTipsEnabled(profile.tips_enabled); setSavedTipsEnabled(profile.tips_enabled); setShowPayerAddresses(profile.show_payer_addresses === true); setSavedShowPayerAddresses(profile.show_payer_addresses === true); }
      setProfileStatus(design ? 'ready' : 'empty');
      setNotice(design ? "Saved profile loaded." : "Buy your alias to edit your page.");
    } catch (reason) { if (!profileLoaded) setProfileStatus('error'); setFailed(true); setNotice(userErrorMessage(reason, "Could not load your profile.")); }
    finally { setRemoteBusy(false); }
  }

  async function publish(makePublic = true) {
    if (claimed.loading || claimed.error) { setFailed(true); setNotice("Wait for your wallet alias to be verified before publishing."); return; }
    const error = validateDraft(draft);
    if (error) { setFailed(true); setNotice(error); return; }
    if (!wallet) { setFailed(true); setNotice("Connect your wallet to save and publish your page."); return; }
    setRemoteBusy(true); setNotice(''); setFailed(false);
    try {
      if (await ensureSession() !== wallet) throw new UserFacingError("The session belongs to another wallet. Load the current profile.");
      const response = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ design: draft, published: makePublic, tips_enabled: tipsEnabled, show_payer_addresses: showPayerAddresses }) });
      const result = await response.json();
      if (!response.ok) throw responseError(response, result, 'Unable to complete the request. Please retry.');
      setPublished(makePublic); setSavedTipsEnabled(tipsEnabled); setSavedShowPayerAddresses(showPayerAddresses);
      if (walletRef.current !== wallet) throw new UserFacingError("The wallet changed. Publication was authorized by the previous account; load its profile to check it.");
      const published = readDraft(JSON.stringify(result.profile.design));
      setDraft(published); setSaved(published);
      try { localStorage.setItem(storageKey, JSON.stringify(published)); setSaved(published); }
      catch { setNotice("Profile saved. Could not save the local backup; you can recover it from your profile."); return; }
      setNotice(makePublic ? "Design published. Your public page now shows your images, links, and appearance." : "Profile saved. Your public page is hidden.");
    } catch (reason) { setFailed(true); setNotice(userErrorMessage(reason, "Could not publish. Your draft is preserved.")); }
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
    try { localStorage.setItem(storageKey, JSON.stringify(normalized)); setDraft(normalized); setSaved(normalized); setFailed(false); setNotice("Draft saved in this browser. Your public page has not been updated."); }
    catch { setFailed(true); setNotice("Could not save. Storage may be full or blocked. Your changes remain in the editor; try smaller images."); }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>, key: 'avatar' | 'cover') {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) {
      setFailed(true); setNotice("Select a JPG, PNG, or WebP file up to 1 MB."); return;
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
    } catch { setFailed(true); setNotice("Could not open the image. Use a valid image with dimensions up to 6000 pixels per side."); }
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
      setNotice('Local draft deleted. You can start over.');
    } catch { setFailed(true); setNotice("Could not delete the saved draft. Try again."); }
  }

  return <div className="mx-auto max-w-7xl [&_button]:touch-manipulation">
    <Link href="/dashboard/products" className="mb-3 inline-flex min-h-11 w-full items-center justify-center gap-2 sm:w-auto rounded-xl border border-violet-400/30 bg-violet-400/10 px-4 py-2 text-sm font-medium text-violet-200">My products · NFT Tickets and subscriptions<ArrowUpRight size={16} aria-hidden="true" /></Link>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3"><div><p className="text-xs uppercase tracking-[.2em] text-zinc-400">Your creator space</p><h1 className="mt-1 text-2xl font-semibold">My page</h1><p className="mt-1 text-sm text-zinc-400">Make it yours. See your changes as you edit.</p></div><div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center"><span role="status" className={`text-xs ${dirty ? 'text-amber-200' : 'text-zinc-400'}`}>{dirty ? "Unsaved changes" : "No unsaved changes"}</span><Button variant="default" onClick={() => void publish()} disabled={imageBusy || remoteBusy || !wallet || !profileLoaded || claimed.loading || !!claimed.error} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl sm:w-auto bg-violet-400 px-5 py-3 text-sm font-semibold text-black hover:bg-violet-300 disabled:opacity-70"><Save size={16} aria-hidden="true" />{remoteBusy ? 'Saving…' : "Save and publish"}</Button><Button variant="default" onClick={save} disabled={imageBusy || remoteBusy} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl sm:w-auto bg-[#00F5A0] px-5 py-3 text-sm font-semibold text-black hover:bg-[#8affd6] disabled:opacity-70"><Save size={16} aria-hidden="true" />Save local draft</Button><SponsorshipWalletControl fullWidthOnMobile /></div></header>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-400/20 bg-violet-400/5 px-4 py-2"><p className="text-xs leading-5 text-violet-200">Edit your draft and select Save and publish to save your page. You can also save a local backup.</p><Link href="/dashboard/sponsorships" className="inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-xl border border-violet-400/20 px-4 py-2 text-xs text-violet-300 sm:w-auto">Manage sponsorships<ArrowUpRight size={14} aria-hidden="true" /></Link></div>
    {profileStatus === 'loading' && <LoadingState label="Loading your saved profile…" />}
    {profileStatus === 'empty' && <section className="mt-4 rounded-xl border border-white/10 p-5"><h2 className="font-semibold">Your page starts with an alias</h2><p className="mt-2 text-sm text-zinc-400">Choose your alias to create and publish your Creator Card.</p><Link href="/profile/buy-alias" className="mt-3 inline-block text-sm text-violet-300">Choose my alias ↗</Link></section>}
    {profileStatus === 'error' && <Button variant="outline" type="button" disabled={remoteBusy} onClick={() => void loadPublished()} className={`${secondary} mt-4`}>{remoteBusy ? "Loading…" : "Retry loading my profile"}</Button>}
    {claimed.loading && <p role="status" className="mt-4 text-xs text-zinc-400">Checking your wallet alias…</p>}{claimed.error && <p role="alert" className="mt-4 text-xs text-red-200">{claimed.error} <Button variant="outline" type="button" onClick={claimed.retry} className="underline">Retry</Button></p>}
    {notice && <p role={failed ? 'alert' : 'status'} className={`mt-4 rounded-xl border p-4 text-sm ${failed ? 'border-red-400/20 text-red-200' : 'border-[#00F5A0]/20 text-emerald-200'}`}>{notice}</p>}
    <section className="mt-3 rounded-2xl border border-white/10 bg-[#101015] p-3"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-sm font-semibold">Your public page</h2><p className="mt-1 text-xs leading-5 text-zinc-400">{published ? "Your page is published. Save and publish to update it." : "Save and publish when your page is ready."}</p></div><div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center"><Button variant="outline" disabled={remoteBusy || imageBusy || dirty} onClick={() => void loadPublished()} className={secondary}>Reload my saved profile</Button><Button variant="outline" disabled={remoteBusy || imageBusy || !profileLoaded} onClick={() => void publish(false)} className={secondary}>Save without publishing</Button>{published && <Link href={`/${draft.alias}`} className="flex min-h-11 w-full items-center justify-center rounded-xl border border-white/15 px-4 py-3 text-xs text-violet-300 sm:w-auto">View public page ↗</Link>}</div></div></section>
    <div className="mt-1"><Button ref={resetButton} variant="ghost" disabled={imageBusy || remoteBusy} onClick={() => setConfirmReset(true)} className="min-h-11 text-xs text-zinc-400">Start over</Button></div>
    <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
      <AlertDialogContent className="dark text-foreground" onCloseAutoFocus={event => { event.preventDefault(); resetButton.current?.focus(); }}>
        <AlertDialogHeader><AlertDialogTitle>Start over?</AlertDialogTitle><AlertDialogDescription>Your saved draft and editor changes will be deleted. Your published page stays available until you publish again.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={imageBusy || remoteBusy} onClick={clearDraft}>Delete draft</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <div className="mt-3 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <Tabs value={tab} onValueChange={value => setTab(value as typeof tabs[number])} className="min-w-0 rounded-2xl border border-white/10 bg-[#101015]">
        <div className="p-3">
          <TabsList aria-label="Editor sections" className="grid !h-auto w-full grid-cols-3 gap-1 sm:grid-cols-5">
            {tabs.map(item => <TabsTrigger key={item} value={item} aria-controls={`card-editor-${item}`} id={`card-tab-${item}`} className="min-h-11">{item}</TabsTrigger>)}
          </TabsList>
        </div>
        <fieldset role="tabpanel" id={`card-editor-${tab}`} aria-labelledby={`card-tab-${tab}`} disabled={remoteBusy || !profileLoaded} className="min-w-0 space-y-6 p-4 disabled:opacity-60 sm:p-7">
          {tab === "Offers" && <CreatorOfferSelection />}
          {tab === "Profile" && <><Badge variant="outline">{published ? "Page published" : "Page unpublished"}</Badge><label className="flex items-center gap-3 text-sm text-zinc-300"><Switch checked={tipsEnabled} onCheckedChange={setTipsEnabled} aria-label="Receive tips in USDC" />Receive tips in USDC</label><div><label className="flex items-center gap-3 text-sm text-zinc-300"><Switch checked={showPayerAddresses} onCheckedChange={setShowPayerAddresses} aria-label="Show tip sender addresses in my activity" aria-describedby="payer-privacy-description" />Show tip sender addresses in my activity</label><p id="payer-privacy-description" className="mt-2 text-xs leading-5 text-zinc-400">Hidden by default. Saving applies this setting to all your tips. Transactions and addresses remain public on Solana.</p></div><div><h2 className="text-lg font-semibold">The person behind your page</h2><p className="mt-2 text-sm leading-6 text-zinc-400">A name, a story, and a place for your community.</p></div>
            <label className="block text-sm text-zinc-300">Alias<Input aria-label="Alias" value={draft.alias} readOnly={!!claimed.alias} disabled={claimed.loading || !!claimed.error} maxLength={30} onChange={e => update('alias', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="your_alias" className={field} /><span className="mt-2 block break-all text-xs text-zinc-400">{claimed.alias ? "Alias purchased by your wallet:" : 'Proposed alias:'} @{draft.alias || 'your_alias'}{!claimed.alias && " · availability pending"}</span></label>
            <label className="block text-sm text-zinc-300">Creator name<Input value={draft.name} maxLength={60} onChange={e => update('name', e.target.value)} placeholder="How does your community know you?" className={field} /></label>
            <label className="block text-sm text-zinc-300">Introduction<Textarea value={draft.bio} maxLength={280} rows={4} onChange={e => update('bio', e.target.value)} placeholder="Share what you create and what inspires you…" className={`${field} resize-y`} /><span className="mt-2 block text-right text-xs text-zinc-400">{draft.bio.length} / 280</span></label>
            {(['avatar'] as const).map(key => <div key={key} className="rounded-xl border border-white/10 p-4"><h3 className="text-sm font-medium">Profile photo</h3><div className="mt-3 flex flex-wrap items-center gap-4"><div className={`relative shrink-0 overflow-hidden bg-white/5 ${key === 'avatar' ? 'size-16 rounded-full' : 'h-16 w-28 rounded-lg'}`}>{draft[key] ? <Image src={draft[key]} alt={key === 'avatar' ? "Selected profile photo" : 'Selected cover'} fill unoptimized sizes="112px" className="object-cover" /> : <div className="flex h-full items-center justify-center text-zinc-400"><ImagePlus size={23} aria-hidden="true" /></div>}</div><div className="w-full min-w-0 sm:w-auto"><label className={`${secondary} cursor-pointer focus-within:outline-2 focus-within:outline-[#00F5A0]`}>Choose image<input type="file" aria-label={key === 'avatar' ? "Upload profile photo" : "Upload cover"} accept="image/png,image/jpeg,image/webp" disabled={imageBusy || remoteBusy} className="sr-only" onChange={e => void upload(e, key)} /></label>{draft[key] && <Button variant="outline" disabled={imageBusy || remoteBusy} onClick={() => update(key, '')} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 text-xs text-zinc-400 sm:ml-3 sm:mt-0 sm:w-auto sm:px-4">Remove</Button>}<p className="mt-2 text-xs text-zinc-400">JPG, PNG, or WebP · up to 1 MB</p></div></div></div>)}
          </>}
          {tab === "Appearance" && <><div><h2 className="text-lg font-semibold">A page that feels like you</h2><p className="mt-2 text-sm text-zinc-400">Choose the tone of your space.</p></div><fieldset><legend className="text-sm text-zinc-300">Accent color</legend><div className="mt-3 flex flex-wrap gap-3">{(Object.keys(accents) as Array<keyof typeof accents>).map(color => <label key={color} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm ${draft.accent === color ? 'border-white/40' : 'border-white/10'}`}><input type="radio" name="accent" checked={draft.accent === color} onChange={() => update('accent', color)} className="sr-only peer" /><span className="size-5 rounded-full peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4" style={{background: accents[color]}} />{color === 'mint' ? "Mint" : color === 'violet' ? "Violet" : "Rose"}{draft.accent === color && <Check size={14} aria-hidden="true" />}</label>)}</div></fieldset><fieldset><legend className="text-sm text-zinc-300">Page background</legend><div className="mt-3 grid grid-cols-2 gap-3">{(['dark','light'] as const).map(theme => <label key={theme} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 p-4 text-sm"><input type="radio" name="theme" checked={draft.theme === theme} onChange={() => update('theme', theme)} />{theme === 'dark' ? "Dark" : "Light"}</label>)}</div></fieldset><label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 p-4 text-sm">Rounded buttons<Switch checked={draft.rounded} onCheckedChange={value => update('rounded', value)} aria-label="Rounded buttons" /></label></>}
          {tab === "Links" && <><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">What you want to share</h2><p className="mt-2 text-sm text-zinc-400">Up to 8 links. Choose their order.</p></div><Button variant="outline" disabled={draft.links.length >= 8} onClick={() => update('links', [...draft.links, {id: crypto.randomUUID(), title:'', url:''}])} className={secondary}><Plus size={16} aria-hidden="true" />Add link</Button></div>{!draft.links.length && <div className="rounded-xl border border-dashed border-white/15 p-7 text-center text-sm leading-6 text-zinc-400">Your website, latest video, or favorite project.<br />Add your first link to see it in the preview.</div>}{draft.links.map((link,index) => <div key={link.id} className="space-y-3 rounded-xl border border-white/10 p-4"><div className="flex items-center justify-between"><p className="text-xs text-zinc-400">Link {index + 1}</p><div className="flex gap-1">{[{label:"Move up", icon:ArrowUp, offset:-1, disabled:index === 0}, {label:"Move down", icon:ArrowDown, offset:1, disabled:index === draft.links.length - 1}].map(({label,icon:Icon,offset,disabled}) => <Button variant="outline" key={label} aria-label={`${label} link ${index + 1}`} disabled={disabled} onClick={() => reorder(index,offset)} className="size-11 rounded-lg p-2 text-zinc-400 hover:bg-white/5 disabled:opacity-25"><Icon size={16} /></Button>)}<Button variant="outline" aria-label={`Delete link ${index + 1}`} onClick={() => update('links', draft.links.filter(item => item.id !== link.id))} className="size-11 rounded-lg p-2 text-red-300 hover:bg-red-400/10"><Trash2 size={16} /></Button></div></div><label className="block text-xs text-zinc-400">Link title {index + 1}<Input value={link.title} maxLength={60} placeholder="My latest video" onChange={e => update('links', draft.links.map(item => item.id === link.id ? {...item,title:e.target.value} : item))} className={field} /></label><label className="block text-xs text-zinc-400">Link URL {index + 1}<Input value={link.url} type="url" maxLength={500} placeholder="https://…" onChange={e => update('links', draft.links.map(item => item.id === link.id ? {...item,url:e.target.value} : item))} className={field} /></label></div>)}</>}
          {tab === "Socials" && <><div><h2 className="text-lg font-semibold">Connect with your community</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Add the full links to your profiles. Leave any network blank to hide it.</p></div>{(['instagram','youtube','x'] as const).map(network => <label key={network} className="block text-sm text-zinc-300"><span className="inline-flex items-center gap-2"><SocialIcon network={network} />{socialLabels[network as keyof typeof socialLabels]}</span><Input aria-label={socialLabels[network]} value={draft.socials[network]} type="url" maxLength={500} placeholder={`https://${network === 'x' ? 'x' : network}.com/your_profile`} onChange={e => update('socials', {...draft.socials,[network]:e.target.value})} aria-invalid={!!draft.socials[network] && !safeLink(draft.socials[network])} aria-describedby={`social-help-${network}`} className={field} /><span id={`social-help-${network}`} className={`mt-2 block text-xs ${draft.socials[network] && !safeLink(draft.socials[network]) ? 'text-red-300' : 'text-zinc-400'}`}>{draft.socials[network] && !safeLink(draft.socials[network]) ? "Use a full URL starting with https://." : "Visible on your card when published."}</span></label>)}</>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5"><p className="text-xs text-zinc-400">The preview updates instantly.</p><Button variant="outline" disabled={!dirty || imageBusy} onClick={() => { uploads.current.avatar++; uploads.current.cover++; setTipsEnabled(savedTipsEnabled); setShowPayerAddresses(savedShowPayerAddresses); setDraft(structuredClone(saved)); setNotice("Restored your last saved draft."); setFailed(false); }} className="min-h-11 w-full rounded-xl border border-white/10 px-4 py-3 text-xs text-zinc-400 hover:text-white disabled:opacity-30 sm:w-auto">Discard changes</Button></div>
        </fieldset>
      </Tabs>
      <aside className="min-w-0 self-start xl:sticky xl:top-7"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><Eye size={16} aria-hidden="true" />Preview</h2><p className="mt-1 text-xs text-zinc-400">Preview of your changes</p></div><div className="flex gap-1 rounded-lg border border-white/10 p-1"><Button variant="outline" aria-label="Mobile preview" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')} className={`rounded-md p-2 ${device === 'mobile' ? 'bg-white/10 text-white' : 'text-zinc-400'}`}><Smartphone size={16} /></Button><Button variant="outline" aria-label="Desktop preview" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')} className={`rounded-md p-2 ${device === 'desktop' ? 'bg-white/10 text-white' : 'text-zinc-400'}`}><Monitor size={16} /></Button></div></div>
        <Link href="/dashboard/card/preview" target="_blank" rel="noopener noreferrer" className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-xs text-violet-300">View saved draft as a full page<ArrowUpRight size={14} /></Link>
        {dirty && <p className="mb-4 text-center text-xs text-amber-200">Save your changes before opening the full page.</p>}
        <div className={`mx-auto overflow-hidden rounded-3xl border border-white/15 shadow-2xl transition-[max-width] ${device === 'mobile' ? 'max-w-[340px]' : 'max-w-full'}`}>
          <PublicCreatorCard creator={{ id: 'draft', wallet, alias: draft.alias || 'your_alias', tipsEnabled, design: { ...draft, name: draft.name || 'Your creator name' } }} preview embedded />
        </div><p className="mx-auto mt-4 max-w-sm text-center text-xs leading-5 text-zinc-400">Valid HTTPS links can be opened from the preview.</p>
      </aside>
    </div>
  </div>;
}

