'use client';
import { useCopy } from "@/i18n/copy";

import { saveCreatorProfile } from '@/lib/creator-save-client';
import styles from './PublicCreatorCard.module.css';
import { sessionDurationLabel } from '@/lib/offer-terms';
import type { CSSProperties } from 'react';
import { CREATOR_ACCENTS } from '@/lib/creator-draft';
import { UserFacingError, userErrorMessage, responseError } from '@/lib/user-facing-error';
import { Booking, Instagram, Substack, Telegram, Profile, Tiktok, Youtube } from '@/components/CardIcons';

import Image from 'next/image';
import Link from '@/i18n/link';
import { useRef, useState, type ChangeEvent, type FormEvent, type PointerEvent } from 'react';
import { ArrowUpRight, Globe, Heart, ImagePlus, Link2, LoaderCircle, Pencil, Share2, UserRound, X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import MonthlyPlans from './MonthlyPlans';
import OfferCheckout from './OfferCheckout';
import CallBookingPanel from '@/components/CallBookingPanel';
import { TipForm } from '@/components/TipForm';
import { useWalletSession } from '@/components/WalletSessionProvider';
import { draftFromProfile, safeLink, type CreatorDraft, type CreatorOffer } from '@/lib/creator-draft';
import type { PublicCreator } from '@/lib/public-creator';
import CreatorCallHistory from './CreatorCallHistory';

type EditableText = 'name' | 'bio';
function OfferRowContents({ offer }: { offer: CreatorOffer }) {
  const t = useCopy();
  return <><Link2 size={21} className="shrink-0 text-violet-400" aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block break-words font-medium">{offer.title || t('Offer title')}</span>{offer.description && <span className="mt-1 block whitespace-pre-line break-words text-xs text-white/60">{offer.description}</span>}{offer.price && <span className="mt-1 block break-words text-xs text-violet-200">{offer.price}{t(" USDC")}{offer.billingPeriod && ` / ${offer.billingPeriod === 'month' ? t('month') : t('session')}`}</span>}{offer.type === 'bookings' && offer.durationMinutes && <span className="mt-1 block text-xs text-white/70">{sessionDurationLabel(offer.durationMinutes, t.locale)}{t(" per session")}</span>}{offer.billingPeriod === 'month' && <span className="mt-1 block text-xs text-white/60">{t("Payment approval required each month")}</span>}</span><ArrowUpRight size={16} className="shrink-0 text-white/40" aria-hidden="true" /></>;
}


export function PublicCreatorCard({ creator, preview = false, embedded = false, showDetails = true }: { creator: PublicCreator; preview?: boolean; embedded?: boolean; showDetails?: boolean }) {
  const t = useCopy();
  const [savedDesign, setDesign] = useState(creator.design);
  const design = preview ? creator.design : savedDesign;
  const session = useWalletSession();
  const isOwner = !preview && (session.connectedWallet || session.wallet) === creator.wallet;
  const imageInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<EditableText | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);
  const Container = embedded ? 'div' : 'main';
  const light = design.theme === 'light';
  const [siteLink, ...otherLinks] = design.links.filter(link => safeLink(link.url));
  const accent = CREATOR_ACCENTS[design.accent];
  const appearanceStyle = { "--card-accent": accent, "--card-accent-ink": light && ['white', 'yellow', 'cyan', 'mint'].includes(design.accent) ? '#52525b' : !light && design.accent === 'black' ? '#a1a1aa' : accent } as CSSProperties;
  const offerAppearanceStyle = {
    ...appearanceStyle,
    "--offer-accent": accent,
    "--offer-button-ink": design.accent === 'black' ? '#ffffff' : '#111111',
    "--offer-surface": light ? '#ffffff' : '#101015',
    "--offer-text": light ? '#18181b' : '#ffffff',
  } as CSSProperties;
  function resetCardPressure(stage: HTMLDivElement) {
    delete stage.dataset.pressed;
    for (const property of ['--card-tilt-x', '--card-tilt-y', '--card-press-z']) stage.style.removeProperty(property);
  }
  function pressCard(event: PointerEvent<HTMLDivElement>) {
    const stage = event.currentTarget;
    if (event.pointerType === 'touch' || !window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches) {
      resetCardPressure(stage); return;
    }
    // Measure the stationary frame so tilting the card cannot shift its target.
    const bounds = stage.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    stage.style.setProperty('--card-tilt-x', `${-y * 8}deg`);
    stage.style.setProperty('--card-tilt-y', `${x * 8}deg`);
    stage.style.setProperty('--card-press-z', `${-6 - Math.hypot(x, y) / Math.SQRT2 * 12}px`);
    stage.dataset.pressed = 'true';
  }

  async function saveChange(change: Partial<Pick<CreatorDraft, 'name' | 'bio' | 'avatar'>>) {
    if (!isOwner || await session.ensureSession() !== creator.wallet) throw new UserFacingError(t('Sign in with the wallet that owns this card.'));
    // Merge only the edited field into the current profile, preserving settings
    // and any changes made in the dashboard since this page was opened.
    const response = await fetch('/api/profile', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw responseError(response, result, t('Unable to complete the request. Please retry.'));
    const profile = result.profile;
    if (!profile || profile.wallet_address !== creator.wallet || profile.username !== creator.alias) throw new UserFacingError(t('Unable to load the owned card.'));
    const latest = draftFromProfile({ ...profile, alias: profile.username, display_name: profile.display_name || profile.username, bio: profile.bio || '' });
    const savedResponse = await saveCreatorProfile(session, creator.wallet, { design: { ...latest, ...change }, published: profile.published, tips_enabled: profile.tips_enabled });
    const saved = await savedResponse.json();
    if (!savedResponse.ok) throw responseError(savedResponse, saved, t('Unable to save your card. Your changes are still here.'));
    setDesign(saved.profile.design);
    setNotice(t('Card updated.')); setFailed(false);
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
    catch (reason) { setFailed(true); setNotice(userErrorMessage(reason, t('Unable to save. Your changes are still here.'))); }
    finally { setBusy(false); }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || !isOwner || busy) return;
    setUploading(true); setBusy(true); setNotice(''); setFailed(false);
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) throw new UserFacingError(t('Choose a JPG, PNG or WebP image up to 1 MB.'));
      const bitmap = await createImageBitmap(file);
      const tooLarge = bitmap.width > 6000 || bitmap.height > 6000;
      bitmap.close();
      if (tooLarge) throw new UserFacingError(t('Choose an image up to 6000 pixels per side.'));
      const avatar = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error(t('Unable to read the image.'))); reader.readAsDataURL(file);
      });
      await saveChange({ avatar });
    } catch (reason) { setFailed(true); setNotice(userErrorMessage(reason, t('Unable to update the portrait.'))); }
    finally { setUploading(false); setBusy(false); }
  }
  async function share() {
    try {
      const url = `${window.location.origin}${t.href(`/${creator.alias}`)}`;
      if (navigator.share) await navigator.share({ title: design.name, url });
      else { await navigator.clipboard.writeText(url); setNotice(t('Page link copied.')); setFailed(false); }
    } catch (reason) { if (!(reason instanceof Error && reason.name === 'AbortError')) { setNotice(t('Unable to share. Copy the page URL from your browser.')); setFailed(true); } }
  }
  const textEditor = (field: EditableText) => <form onSubmit={event => void saveText(event)} className="space-y-3">
    <label className="block text-xs text-white/70">{field === 'name' ? t('Creator name') : t('Creator bio')}
      {field === 'name' ? <input autoFocus required maxLength={60} value={text} onChange={event => setText(event.target.value)} disabled={busy} className="mt-2 w-full rounded-xl border border-white/20 bg-black/60 px-3 py-3 text-base text-white outline-none focus:border-violet-400" /> : <textarea autoFocus maxLength={280} rows={3} value={text} onChange={event => setText(event.target.value)} disabled={busy} className="mt-2 w-full resize-y rounded-xl border border-white/20 bg-black/60 px-3 py-3 text-base text-white outline-none focus:border-violet-400" />}
    </label><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><button disabled={busy} className="min-h-11 rounded-xl bg-violet-400 px-3 py-2 text-sm font-semibold text-black disabled:opacity-50">{busy ? t('Saving…') : t('Save changes')}</button><button type="button" disabled={busy} onClick={() => setEditing(null)} className="min-h-11 rounded-xl border border-white/20 px-3 py-2 text-sm">{t("Cancel")}</button></div>
  </form>;

  return <Container id={embedded ? undefined : "main-content"} tabIndex={embedded ? undefined : -1} className={`${embedded ? "bg-transparent p-3" : "min-h-screen px-4 pb-5 sm:px-6 sm:pb-7"} ${light ? `${embedded ? '' : 'bg-white'} text-zinc-900` : `${embedded ? '' : 'bg-[#08080b]'} text-white`}`}>
    {!embedded && <nav aria-label={t("Page navigation")} className="mt-2 mb-3 flex w-full items-center justify-between gap-4">
      <Link href="/" aria-label={t("VYNX home")} className="flex min-h-11 min-w-11 items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"><Image src="/logo-white.svg" alt="" width={22} height={16} className={`h-4 w-auto${light ? ' brightness-0' : ''}`} /></Link>
      <Link href="/dashboard" aria-label={t("My profile")} title={t("My profile")} className="flex size-11 items-center justify-center rounded-full border border-current/10 opacity-70 transition hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"><Profile size={20} aria-hidden="true" /></Link>
    </nav>}
    <div className="mx-auto max-w-[460px]">
      <div className={styles.cardStage} onPointerMove={pressCard} onPointerLeave={event => resetCardPressure(event.currentTarget)} onPointerCancel={event => resetCardPressure(event.currentTarget)}>
      <section aria-label={t("Creator card")} data-testid="creator-card" data-light={light} data-card-glow={design.cardGlow ?? false} data-button-glow={design.buttonGlow ?? false} data-rounded={design.rounded} style={appearanceStyle} className={`${styles.card} relative isolate flex aspect-[1/1.618] w-full flex-col overflow-hidden rounded-[2rem] border border-violet-400/30 bg-[#17131e] text-white shadow-[0_24px_80px_-24px_#a855f755]`}>
        {design.avatar ? <Image src={design.avatar} alt={`${design.name} avatar`} fill sizes="(max-width: 492px) calc(100vw - 32px), 460px" priority unoptimized className="-z-20 object-cover object-top" /> : <div className={`${styles.placeholder} absolute inset-0 -z-20 flex items-start justify-center bg-[radial-gradient(ellipse_at_top,#643676_0%,#241b30_45%,#17131e_80%)] pt-[18%]`}><UserRound size={96} className="text-violet-200/25" aria-hidden="true" /></div>}
        <div className={`${styles.overlay} pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(12,8,18,0.04)_0%,rgba(18,12,25,0.15)_25%,rgba(22,17,30,0.6)_48%,rgba(23,19,30,0.8)_80%)]`} />
        {isOwner && <><input ref={imageInput} tabIndex={-1} type="file" aria-label={t("Update card portrait")} accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => void upload(event)} className="sr-only" /><button type="button" disabled={busy} aria-busy={uploading} aria-label={t("Update card image")} onClick={() => imageInput.current?.click()} className="group/image absolute inset-x-0 top-0 flex h-[38%] items-end justify-center pb-5 text-xs text-white/80 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-violet-400 disabled:opacity-50"><span className={`flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3 py-2 backdrop-blur-md transition-opacity ${design.avatar && !uploading ? 'opacity-0 group-hover/image:opacity-100 group-focus-visible/image:opacity-100' : 'opacity-100'}`}><span role={uploading ? 'status' : undefined} className="flex items-center gap-2">{uploading ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ImagePlus size={15} aria-hidden="true" />}{uploading ? t('Uploading image…') : t('Click to change image')}</span></span></button></>}
        <div className="flex flex-1 flex-col justify-end px-5 pt-[60%] pb-5 sm:px-6 sm:pb-6">
          {isOwner && editing === 'name' ? textEditor('name') : <h1 className="break-words text-3xl font-semibold tracking-tight">{isOwner ? <button disabled={busy} onClick={() => edit('name')} aria-label={t("Edit creator name")} className="w-full text-left hover:text-violet-200 focus-visible:outline-2 focus-visible:outline-violet-400">{design.name}<Pencil size={13} className="ml-2 inline opacity-50" aria-hidden="true" /></button> : design.name}</h1>}
          <p className="mt-2 break-words text-sm" style={{ color: "var(--card-accent-ink)" }}>@{creator.alias}</p>
          <div className="mt-3">{isOwner && editing === 'bio' ? textEditor('bio') : <p className="whitespace-pre-line break-words text-sm leading-6 text-white/75">{isOwner ? <button disabled={busy} onClick={() => edit('bio')} aria-label={t("Edit creator bio")} className="w-full whitespace-pre-line text-left hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400">{design.bio || t('Click to add your story.')}<Pencil size={12} className="ml-2 inline opacity-50" aria-hidden="true" /></button> : design.bio}</p>}</div>
          <nav aria-label={t("Creator social links")} className="mt-5 flex flex-wrap items-center justify-center gap-1 sm:gap-3">{siteLink && <a href={safeLink(siteLink.url)!} target="_blank" rel="noopener noreferrer" aria-label={siteLink.title || t("Website")} title={siteLink.title || t("Website")} className="flex size-11 items-center justify-center rounded-xl bg-white/5 text-white/80 transition hover:bg-white/10"><Globe size={23} aria-hidden="true" /></a>}{Object.entries(design.socials).filter(([, url]) => safeLink(url)).map(([network, url]) => <a key={network} href={safeLink(url)!} target="_blank" rel="noopener noreferrer" aria-label={network === 'x' ? t('X') : network === 'youtube' ? t('YouTube') : network === 'substack' ? 'Substack' : network === 'telegram' ? 'Telegram' : network === 'tiktok' ? t('TikTok') : t('Instagram')} className="flex size-11 items-center justify-center rounded-xl bg-white/5 text-white/80 transition hover:bg-white/10">{network === 'instagram' ? <Instagram size={23} aria-hidden="true" /> : network === 'youtube' ? <Youtube size={23} aria-hidden="true" /> : network === 'substack' ? <Substack size={23} /> : network === 'telegram' ? <Telegram size={23} /> : network === 'tiktok' ? <Tiktok size={23} /> : <span className="text-xl" style={{ color: accent }} aria-hidden="true">𝕏</span>}</a>)}<button disabled={preview} onClick={() => void share()} aria-label={t("Share creator page")} className="flex size-11 items-center justify-center rounded-xl bg-white/5 text-white/80 hover:bg-white/10"><Share2 size={21} aria-hidden="true" /></button></nav>
        </div>
      </section>
      </div>
      {showDetails && <section aria-label={t("Offers and links")} data-testid="creator-details" data-light={light} data-button-glow={design.buttonGlow ?? false} data-rounded={design.rounded} style={appearanceStyle} className={`${styles.details} mt-6 min-w-0 rounded-2xl border border-current/10 p-4 sm:p-5 ${light ? 'bg-white text-zinc-900' : 'bg-[#101015] text-white'}`}>
          {!!otherLinks.length && <nav aria-label={t("Creator website links")} className="mb-4 flex min-w-0 flex-wrap gap-2">{otherLinks.map(link => <a key={link.id} href={safeLink(link.url)!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-white/15 bg-white/[.07] px-3 py-2 text-sm transition hover:bg-violet-400/15"><span className="min-w-0 break-words">{t(link.title)}</span><ArrowUpRight size={14} className="shrink-0" aria-hidden="true" /></a>)}</nav>}
          <div className="space-y-2.5">
            {(design.offers ?? []).filter(offer => offer.type !== 'tickets').map(offer => <Dialog key={offer.id}>
              <DialogPrimitive.Trigger asChild><button type="button" disabled={preview} className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-violet-400/25 bg-violet-400/10 px-4 py-3 text-sm backdrop-blur-md transition hover:bg-violet-400/20 text-left"><OfferRowContents offer={offer} /></button></DialogPrimitive.Trigger>
              <DialogContent aria-describedby={undefined} style={offerAppearanceStyle} className={`${styles.offerModal} max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto`}><DialogTitle className="sr-only">{offer.billingPeriod === 'month' ? t('Monthly offer') : t('Offer')}: {offer.title}</DialogTitle><div aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl border" style={{ color: 'var(--card-accent-ink)', borderColor: 'color-mix(in srgb, var(--card-accent-ink) 25%, transparent)', background: 'color-mix(in srgb, var(--offer-accent) 12%, transparent)' }}><Booking size={30} /></div>{offer.billingPeriod === 'month' ? <MonthlyPlans key={`${creator.alias}:${offer.id}`} alias={creator.alias} offer={offer} creatorWallet={creator.wallet} /> : <OfferCheckout key={`${creator.alias}:${offer.id}`} alias={creator.alias} offer={offer} creatorWallet={creator.wallet} />}{safeLink(offer.url) && <a href={safeLink(offer.url)!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm text-violet-300 underline">{t("More details")}<ArrowUpRight size={14} aria-hidden="true" /></a>}</DialogContent>
            </Dialog>)}
            <Dialog>
              <DialogPrimitive.Trigger asChild>
                <button type="button" disabled={preview} className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-violet-400/35 bg-violet-400/15 px-4 py-3 text-left text-sm transition hover:bg-violet-400/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"><Heart size={23} className="shrink-0 text-violet-300" aria-hidden="true" /><span className="flex-1">{t("Tips")}</span><span className="text-xs text-white/60">{creator.tipsEnabled ? t('USDC') : t('Paused')}</span><ArrowUpRight size={15} className="text-white/40" aria-hidden="true" /></button>
              </DialogPrimitive.Trigger>
              <DialogContent aria-describedby={undefined} style={offerAppearanceStyle} className={`${styles.offerModal} max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-3xl p-0 pt-12 sm:rounded-3xl`}>
                <DialogTitle className="sr-only">{t("Tip @")}{creator.alias}</DialogTitle>
                <DialogPrimitive.Close aria-label={t("Close tipping")} title={t("Close (Esc)")} className="absolute top-2 right-3 flex size-11 items-center justify-center border-0 bg-transparent opacity-70 transition hover:opacity-100 focus-visible:outline-2 focus-visible:outline-violet-400"><X size={20} aria-hidden="true" /></DialogPrimitive.Close>
                {!preview && <TipForm alias={creator.alias} creatorWallet={creator.wallet} enabled={creator.tipsEnabled} />}
              </DialogContent>
            </Dialog>
          </div>
      </section>}
      {!preview && creator.published !== false && <CallBookingPanel key={`${creator.alias}:${session.wallet}`} alias={creator.alias} accent={accent} accentInk={design.accent === 'black' ? '#ffffff' : '#111111'} />}
      {!preview && creator.published !== false && <CreatorCallHistory key={creator.alias} alias={creator.alias} />}
      {notice && <p role={failed ? 'alert' : 'status'} className={`mt-4 rounded-xl border p-3 text-sm ${failed ? 'border-red-400/30 text-red-400' : 'border-emerald-400/30 text-emerald-500'}`}>{t(notice)}</p>}
    </div>
    {!preview && creator.published === false && <p role="status" className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 z-40 max-w-[460px] rounded-xl border border-violet-400/25 p-4 text-xs leading-5 shadow-lg backdrop-blur-md sm:left-6 sm:right-6 ${light ? 'bg-white/95 text-zinc-900' : 'bg-[#17131e]/95 text-white'}`}>{t("Your card is unpublished. Only you can view it.")}</p>}
  </Container>;
}
