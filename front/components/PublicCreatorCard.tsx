'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowUpRight, Heart, ImagePlus, Camera, Link2, Pencil, Share2, UserRound, Play, X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { TipForm } from '@/components/TipForm';
import { useWalletSession } from '@/components/WalletSessionProvider';
import { draftFromProfile, safeLink, type CreatorDraft } from '@/lib/creator-draft';
import type { PublicCreator } from '@/lib/public-creator';

type EditableText = 'name' | 'bio';

export function PublicCreatorCard({ creator }: { creator: PublicCreator }) {
  const [design, setDesign] = useState(creator.design);
  const session = useWalletSession();
  const isOwner = (session.connectedWallet || session.wallet) === creator.wallet;
  const imageInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<EditableText | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);
  const light = design.theme === 'light';
  const accent = { mint: '#00F5A0', violet: '#b69aff', rose: '#ff94b9' }[design.accent];

  async function saveChange(change: Partial<Pick<CreatorDraft, 'name' | 'bio' | 'avatar'>>) {
    if (!isOwner || await session.ensureSession() !== creator.wallet) throw new Error('Sign in with the wallet that owns this card.');
    // Merge only the edited field into the current profile, preserving settings
    // and any changes made in the dashboard since this page was opened.
    const response = await fetch('/api/profile', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    const profile = result.profile;
    if (!profile || profile.wallet_address !== creator.wallet || profile.username !== creator.alias) throw new Error('Unable to load the owned card.');
    const latest = draftFromProfile({ ...profile, alias: profile.username, display_name: profile.display_name || profile.username, bio: profile.bio || '' });
    const savedResponse = await fetch('/api/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ design: { ...latest, ...change }, published: profile.published, tips_enabled: profile.tips_enabled }),
    });
    const saved = await savedResponse.json();
    if (!savedResponse.ok) throw new Error(saved.error);
    setDesign(saved.profile.design);
    setNotice('Card updated.'); setFailed(false);
  }

  function edit(field: EditableText) {
    if (!isOwner || busy) return;
    setEditing(field); setText(design[field]); setNotice(''); setFailed(false);
  }
  async function saveText(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true); setNotice('');
    try { await saveChange({ [editing]: text.trim() }); setEditing(null); }
    catch (reason) { setFailed(true); setNotice(reason instanceof Error ? reason.message : 'Unable to save. Your changes are still here.'); }
    finally { setBusy(false); }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || !isOwner) return;
    setBusy(true); setNotice(''); setFailed(false);
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) throw new Error('Choose a JPG, PNG or WebP image up to 1 MB.');
      const bitmap = await createImageBitmap(file);
      const tooLarge = bitmap.width > 6000 || bitmap.height > 6000;
      bitmap.close();
      if (tooLarge) throw new Error('Choose an image up to 6000 pixels per side.');
      const avatar = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Unable to read the image.')); reader.readAsDataURL(file);
      });
      await saveChange({ avatar });
    } catch (reason) { setFailed(true); setNotice(reason instanceof Error ? reason.message : 'Unable to update the portrait.'); }
    finally { setBusy(false); }
  }
  async function share() {
    try {
      const url = `${window.location.origin}/${creator.alias}`;
      if (navigator.share) await navigator.share({ title: design.name, url });
      else { await navigator.clipboard.writeText(url); setNotice('Page link copied.'); setFailed(false); }
    } catch (reason) { if (!(reason instanceof Error && reason.name === 'AbortError')) { setNotice('Unable to share. Copy the page URL from your browser.'); setFailed(true); } }
  }
  const textEditor = (field: EditableText) => <form onSubmit={event => void saveText(event)} className="space-y-3">
    <label className="block text-xs text-white/70">{field === 'name' ? 'Creator name' : 'Creator bio'}
      {field === 'name' ? <input autoFocus required maxLength={60} value={text} onChange={event => setText(event.target.value)} disabled={busy} className="mt-2 w-full rounded-xl border border-white/20 bg-black/60 px-3 py-3 text-base text-white outline-none focus:border-violet-400" /> : <textarea autoFocus maxLength={280} rows={3} value={text} onChange={event => setText(event.target.value)} disabled={busy} className="mt-2 w-full resize-y rounded-xl border border-white/20 bg-black/60 px-3 py-3 text-base text-white outline-none focus:border-violet-400" />}
    </label><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><button disabled={busy} className="min-h-11 rounded-xl bg-violet-400 px-3 py-2 text-sm font-semibold text-black disabled:opacity-50">{busy ? 'Saving…' : 'Save changes'}</button><button type="button" disabled={busy} onClick={() => setEditing(null)} className="min-h-11 rounded-xl border border-white/20 px-3 py-2 text-sm">Cancel</button></div>
  </form>;

  return <main className={`min-h-screen px-4 py-5 sm:px-6 sm:py-7 ${light ? 'bg-[#f5f5f7] text-zinc-900' : 'bg-[#08080b] text-white'}`}>
    <nav aria-label="Page navigation" className="mb-5 flex w-full items-center justify-between gap-4">
      <Link href="/" aria-label="VYNX home" className="flex min-h-11 min-w-11 items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"><Image src="/logo-white.svg" alt="" width={22} height={16} className={`h-4 w-auto${light ? ' brightness-0' : ''}`} /></Link>
      <Link href="/dashboard" aria-label="My profile" title="My profile" className="flex size-11 items-center justify-center rounded-full border border-current/10 opacity-70 transition hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"><UserRound size={20} aria-hidden="true" /></Link>
    </nav>
    <div className="mx-auto max-w-[460px]">
      <section aria-label="Creator card" data-testid="creator-card" className="relative isolate flex aspect-[1/1.618] w-full flex-col overflow-hidden rounded-[2rem] border border-violet-400/30 bg-[#17131e] text-white shadow-[0_24px_80px_-24px_#a855f755]">
        {design.avatar ? <Image src={design.avatar} alt={`${design.name} avatar`} fill sizes="(max-width: 492px) calc(100vw - 32px), 460px" priority unoptimized className="-z-20 object-cover object-top" /> : <div className="absolute inset-0 -z-20 flex items-start justify-center bg-[radial-gradient(ellipse_at_top,#643676_0%,#241b30_45%,#17131e_80%)] pt-[18%]"><UserRound size={96} className="text-violet-200/25" aria-hidden="true" /></div>}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(12,8,18,0.04)_0%,rgba(18,12,25,0.15)_25%,rgba(22,17,30,0.6)_48%,rgba(23,19,30,0.8)_80%)]" />
        <span className="absolute top-5 right-5 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-violet-100 backdrop-blur-md">@{creator.alias}</span>
        {isOwner && <><input ref={imageInput} type="file" aria-label="Update card portrait" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => void upload(event)} className="sr-only" /><button type="button" disabled={busy} aria-label="Update card image" onClick={() => imageInput.current?.click()} className="group/image absolute inset-x-0 top-0 flex h-[38%] items-end justify-center pb-5 text-xs text-white/80 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-violet-400 disabled:opacity-50"><span className={`flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3 py-2 backdrop-blur-md transition-opacity ${design.avatar && !busy ? 'opacity-0 group-hover/image:opacity-100 group-focus-visible/image:opacity-100' : 'opacity-100'}`}><ImagePlus size={15} aria-hidden="true" />{busy ? 'Saving…' : 'Click to change image'}</span></button></>}
        <div className="flex flex-1 flex-col justify-end px-5 pt-[60%] pb-5 sm:px-6 sm:pb-6">
          {isOwner && editing === 'name' ? textEditor('name') : <h1 aria-label={design.name} className="break-words text-3xl font-semibold tracking-tight">{isOwner ? <button disabled={busy} onClick={() => edit('name')} aria-label="Edit creator name" className="w-full text-left hover:text-violet-200 focus-visible:outline-2 focus-visible:outline-violet-400">{design.name}<Pencil size={13} className="ml-2 inline opacity-50" aria-hidden="true" /></button> : design.name}</h1>}
          <div className="mt-3">{isOwner && editing === 'bio' ? textEditor('bio') : <p className="whitespace-pre-line break-words text-sm leading-6 text-white/75">{isOwner ? <button disabled={busy} onClick={() => edit('bio')} aria-label="Edit creator bio" className="w-full whitespace-pre-line text-left hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400">{design.bio || 'Click to add your story.'}<Pencil size={12} className="ml-2 inline opacity-50" aria-hidden="true" /></button> : design.bio}</p>}</div>
          <div className="mt-5 space-y-2.5">{design.links.filter(link => safeLink(link.url)).map(link => <a key={link.id} href={safeLink(link.url)!} target="_blank" rel="noopener noreferrer" className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-white/15 bg-white/[.07] px-4 py-3 text-sm backdrop-blur-md transition hover:bg-violet-400/15"><Link2 size={21} className="shrink-0 text-violet-400" aria-hidden="true" /><span className="min-w-0 flex-1 break-words">{link.title}</span><ArrowUpRight size={16} className="shrink-0 text-white/40" aria-hidden="true" /></a>)}
            <Dialog>
              <DialogPrimitive.Trigger asChild>
                <button type="button" className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-violet-400/35 bg-violet-400/15 px-4 py-3 text-left text-sm transition hover:bg-violet-400/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"><Heart size={23} className="shrink-0 text-violet-300" aria-hidden="true" /><span className="flex-1">Tips</span><span className="text-xs text-white/60">{creator.tipsEnabled ? 'USDC · SOL' : 'Paused'}</span><ArrowUpRight size={15} className="text-white/40" aria-hidden="true" /></button>
              </DialogPrimitive.Trigger>
              <DialogContent aria-describedby={undefined} className={`max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-3xl p-0 pt-12 sm:rounded-3xl ${light ? 'border-zinc-200 bg-[#f5f5f7] text-zinc-900' : 'border-violet-400/30 bg-[#17131e] text-white'}`}>
                <DialogTitle className="sr-only">Tip @{creator.alias}</DialogTitle>
                <DialogPrimitive.Close aria-label="Close tipping" title="Close (Esc)" className="absolute top-2 right-3 flex size-11 items-center justify-center border-0 bg-transparent opacity-70 transition hover:opacity-100 focus-visible:outline-2 focus-visible:outline-violet-400"><X size={20} aria-hidden="true" /></DialogPrimitive.Close>
                <TipForm alias={creator.alias} creatorWallet={creator.wallet} enabled={creator.tipsEnabled} />
              </DialogContent>
            </Dialog>
          </div>
          <nav aria-label="Creator social links" className="mt-5 flex flex-wrap items-center justify-center gap-3">{Object.entries(design.socials).filter(([, url]) => safeLink(url)).map(([network, url]) => <a key={network} href={safeLink(url)!} target="_blank" rel="noopener noreferrer" aria-label={network === 'x' ? 'X' : network === 'youtube' ? 'YouTube' : 'Instagram'} className="flex size-11 items-center justify-center rounded-xl bg-white/5 text-white/80 transition hover:bg-white/10">{network === 'instagram' ? <Camera size={23} aria-hidden="true" /> : network === 'youtube' ? <Play size={23} aria-hidden="true" /> : <span className="text-xl" aria-hidden="true">𝕏</span>}</a>)}<button onClick={() => void share()} aria-label="Share creator page" className="flex size-11 items-center justify-center rounded-xl bg-white/5 text-white/80 hover:bg-white/10"><Share2 size={21} aria-hidden="true" /></button></nav>
        </div>
      </section>
      {notice && <p role={failed ? 'alert' : 'status'} className={`mt-4 rounded-xl border p-3 text-sm ${failed ? 'border-red-400/30 text-red-400' : 'border-emerald-400/30 text-emerald-500'}`}>{notice}</p>}
      <footer className={`mt-6 text-center text-[10px] tracking-widest opacity-50 ${creator.published === false ? 'pb-40' : 'pb-16'}`}>VYNX · SOLANA DEVNET</footer>
    </div>
    {creator.published === false && <p role="status" className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-24 z-40 max-w-[460px] rounded-xl border border-violet-400/25 p-4 text-xs leading-5 shadow-lg backdrop-blur-md sm:left-6 sm:right-26 ${light ? 'bg-white/95 text-zinc-900' : 'bg-[#17131e]/95 text-white'}`}>Your card is unpublished. Only you can view it.</p>}
    {isOwner && <Link href="/dashboard/card" aria-label="Edit my creator card" title="Edit my creator card" className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex size-14 items-center justify-center rounded-full text-black shadow-lg transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400 sm:right-6" style={{ background: accent }}><Pencil size={22} aria-hidden="true" /></Link>}
  </main>;
}
