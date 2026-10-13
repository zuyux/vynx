'use client';
import { useCopy } from "@/i18n/copy";

import { SITE_MOTTO } from '@/lib/brand';

import { PaymentDisclosure } from '@/components/PaymentDisclosure';
import { UserFacingError, userErrorMessage } from '@/lib/user-facing-error';

import Link from '@/i18n/link';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, Inbox, RefreshCw, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { Connection, Transaction } from '@solana/web3.js';
import { useSponsorshipWallet } from '@/lib/use-sponsorship-wallet';
import { useClaimedAlias } from '@/lib/use-claimed-alias';
import SponsorshipWalletControl from '@/components/SponsorshipWalletControl';
import { canReview, isLive, money, type SponsorProfile, type SponsorRequest } from '@/lib/sponsorship-domain';
import { campaignFilters, campaignState, nextCampaignAction, type CampaignFilter } from '@/lib/sponsorship-workspace';
import { LoadingState } from '@/components/LoadingState';

const input = 'mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-[#00F5A0]';
const button = 'rounded-xl bg-[#00F5A0] px-5 py-3 text-sm font-bold text-black transition hover:bg-white disabled:opacity-40';
const panel = 'rounded-3xl border border-white/10 bg-[#101015] p-6 sm:p-8';
const statuses = { pending: "Under review", approved: "Awaiting payment", rejected: "Rejected", active: 'Published', ended: 'Ended' };
const statusColors = { pending: 'bg-amber-400/10 text-amber-200', approved: 'bg-violet-400/10 text-violet-200', active: 'bg-emerald-400/10 text-emerald-200', ended: 'bg-white/5 text-zinc-400', rejected: 'bg-red-400/10 text-red-200' };

export default function SponsorshipWorkspace() {
  const t = useCopy();
  const { wallet, solana, signed, sendTransaction } = useSponsorshipWallet();
  const claimed = useClaimedAlias(wallet);
  const [profile, setProfile] = useState<SponsorProfile | null>(null);
  const [campaigns, setCampaigns] = useState<SponsorRequest[]>([]);
  const [loadedWallet, setLoadedWallet] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);
  const [payment, setPayment] = useState<{ id: string; signature: string } | null>(null);
  const [role, setRole] = useState<'creator' | 'brand'>('creator');
  const [filter, setFilter] = useState<CampaignFilter>('all');
  const [now, setNow] = useState(() => Date.now());
  const current = !!wallet && loadedWallet === wallet;
  const visibleCampaigns = current ? campaigns : [];
  const visibleProfile = current ? profile : null;
  const roleCampaigns = visibleCampaigns.filter(campaign => role === 'creator' ? campaign.creator_wallet === wallet : campaign.brand_wallet === wallet);
  const filteredCampaigns = roleCampaigns.filter(campaign => filter === 'all' || campaignState(campaign, now) === filter);
  const received = visibleCampaigns.filter(campaign => campaign.creator_wallet === wallet);
  const sent = visibleCampaigns.filter(campaign => campaign.brand_wallet === wallet);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function run(task: () => Promise<void>, success: string) {
    setBusy(true); setNotice(''); setFailed(false);
    try { await task(); setNotice(success); }
    catch (error) { setFailed(true); setNotice(userErrorMessage(error, t('Could not complete the action.'))); }
    finally { setBusy(false); }
  }

  async function load() {
    const data = await signed('list');
    setProfile(data.profile); setCampaigns(data.campaigns); setLoadedWallet(wallet);
    setPayment(null);
    try {
      const recovery = (data.campaigns as SponsorRequest[]).find(c => c.brand_wallet === wallet && c.status === 'approved' && localStorage.getItem(t("vynx-payment:{v0}", {v0: c.id})));
      if (recovery) setPayment({ id: recovery.id, signature: localStorage.getItem(t("vynx-payment:{v0}", {v0: recovery.id}))! });
    } catch { /* Recovery by manually entering a transaction signature remains available. */ }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current || claimed.loading || claimed.error) {
      setFailed(true); setNotice(t("Load your campaigns before editing your offer."));
      return;
    }
    const form = new FormData(event.currentTarget);
    void run(async () => {
      const data = await signed('save-profile', { alias: claimed.alias || form.get('alias'), display_name: form.get('display_name'),
        bio: form.get('bio'), website: form.get('website'), price_cents: Math.round(Number(form.get('price')) * 100),
        duration_days: Number(form.get('days')), accepting: form.get('accepting') === 'on' });
      setProfile(data.profile); setLoadedWallet(wallet);
    }, t("Your page and offer are saved. You can now share the link."));
  }

  async function pay(campaign: SponsorRequest) {
    if (!solana) throw new UserFacingError(t("Connect your wallet."));
    let savedSignature: string | null = null;
    try { savedSignature = localStorage.getItem(t("vynx-payment:{v0}", {v0: campaign.id})); } catch { /* Optional recovery storage. */ }
    if (payment?.id === campaign.id || savedSignature) throw new UserFacingError(t("You already submitted a payment. Verify its signature before paying again."));
    const data = await signed('checkout', { id: campaign.id });
    const tx = Transaction.from(Uint8Array.from(atob(data.transaction), c => c.charCodeAt(0)));
    const { signature } = await sendTransaction(tx, wallet);
    setPayment({ id: campaign.id, signature });
    // Persist only the recovery reference, never credentials or signing material.
    try { localStorage.setItem(t("vynx-payment:{v0}", {v0: campaign.id}), signature); } catch { /* Optional recovery storage. */ }
    const connection = new Connection('https://api.devnet.solana.com', 'finalized');
    const confirmation = await connection.confirmTransaction({ signature, blockhash: data.blockhash, lastValidBlockHeight: data.lastValidBlockHeight }, 'finalized');
    if (confirmation.value.err) throw new UserFacingError(t("The transfer failed on devnet."));
    await signed('confirm', { id: campaign.id, tx_signature: signature });
    try { localStorage.removeItem(t("vynx-payment:{v0}", {v0: campaign.id})); } catch { /* Optional recovery storage. */ }
    setPayment(null);
    await load();
  }

  function retry(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const signature = String(new FormData(event.currentTarget).get('signature') ?? '').trim();
    void run(async () => { await signed('confirm', { id, tx_signature: signature }); try { localStorage.removeItem(t("vynx-payment:{v0}", {v0: id})); } catch { /* Optional recovery storage. */ } setPayment(null); await load(); }, t("Payment verified. The campaign is now published."));
  }

  return <div className="min-h-screen bg-[#07070a] text-white"><Sidebar creatorAlias={visibleProfile?.alias} /><main id="main-content" tabIndex={-1} className="min-w-0 px-5 py-7 sm:px-8 lg:ml-64 lg:px-10 lg:py-9">
    <div className="mx-auto max-w-7xl">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-5 border-b border-white/10 pb-7"><div><p className="text-xs uppercase tracking-[.2em] text-zinc-400">{t("Your creator space")}</p><h1 className="mt-2 text-2xl font-semibold">{t("Sponsorships")}</h1><p className="mt-2 text-sm text-zinc-400">{t("Choose your collaborations. Follow each agreement through publication.")}</p></div><SponsorshipWalletControl /></header>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-violet-400/20 bg-violet-400/5 p-4 text-sm">
        <p className="text-violet-200">{t("Solana devnet · test USDC with no monetary value. No real funds are charged.")}</p>
        <button disabled={busy || !wallet} onClick={() => void run(load, t("Campaigns updated."))} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white hover:bg-white/5 disabled:opacity-40"><RefreshCw size={14} aria-hidden="true" className={busy ? 'animate-spin motion-reduce:animate-none' : ''} />{busy ? t('Procesando…') : current ? t("Refresh campaigns") : t("Load my campaigns")}</button>
      </div>
      {notice && <p role={failed ? 'alert' : 'status'} className={`mb-6 rounded-xl border p-4 text-sm ${failed ? 'border-red-400/30 text-red-200' : 'border-emerald-400/30 text-emerald-200'}`}>{t(notice)}</p>}
      <div className="mb-7 grid gap-3 sm:grid-cols-3">{[{label:t("To review"),value:received.filter(c => c.status === 'pending').length,icon:Inbox},{label:t("Awaiting your payment"),value:sent.filter(c => c.status === 'approved').length,icon:ArrowUpRight},{label:t("Published on your page"),value:received.filter(c => isLive(c, now)).length,icon:Sparkles}].map(({label,value,icon:Icon}) => <div key={label} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#101015] p-5"><span className="rounded-xl bg-violet-400/10 p-3 text-violet-300"><Icon size={18} aria-hidden="true" /></span><div><p className="text-xs text-zinc-400">{t(label)}</p><p className="mt-1 text-2xl font-semibold">{current ? value : '—'}</p></div></div>)}</div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,.8fr)_minmax(0,1.4fr)]">
        <section className={`${panel} order-2 min-w-0 xl:order-none`}><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{t("Your offer")}</h2><SlidersHorizontal size={18} className="text-zinc-400" aria-hidden="true" /></div><p className="mt-2 text-xs leading-6 text-zinc-400">{t("An exclusive space. A fixed price per period. Each ad requires your approval.")}</p>
          {visibleProfile && <div className="mt-5 rounded-xl border border-violet-400/20 bg-violet-400/5 p-4"><p className="break-all text-sm font-medium">@{visibleProfile.alias}</p><p className="mt-2 text-lg font-semibold">{money(visibleProfile.price_cents)}{t(" USDC ")}<span className="text-xs font-normal text-zinc-400">/ {visibleProfile.duration_days}{t(" days")}</span></p><span className={`mt-3 inline-block rounded-full px-2 py-1 text-[10px] ${visibleProfile.accepting ? 'bg-emerald-400/10 text-emerald-200' : 'bg-amber-400/10 text-amber-200'}`}>{visibleProfile.accepting ? t('Accepting proposals') : t('Proposals paused')}</span></div>}
          {claimed.loading && <p role="status" className="mt-4 text-xs text-zinc-400">{t("Checking your wallet alias…")}</p>}{claimed.error && <p role="alert" className="mt-4 text-xs text-red-200">{t(claimed.error)} <button type="button" onClick={claimed.retry} className="underline">{t("Retry")}</button></p>}
          <form key={`${wallet}:${current}:${claimed.alias || visibleProfile?.alias || ''}`} onSubmit={save} className="mt-6 space-y-4">
            <fieldset disabled={busy || !current || claimed.loading || !!claimed.error} className="space-y-4 disabled:opacity-50">
            <label className="block text-sm text-zinc-300">{t("Alias")}<input aria-label={t("Alias")} name="alias" required pattern="[a-zA-Z0-9_]{1,30}" maxLength={30} defaultValue={claimed.alias || visibleProfile?.alias} readOnly={!!claimed.alias} placeholder="your_alias" className={input} />{claimed.alias && <span className="mt-2 block text-xs text-[#00F5A0]">{t("Alias purchased by your connected wallet.")}</span>}</label>
            <label className="block text-sm text-zinc-300">{t("Name")}<input name="display_name" required maxLength={60} defaultValue={visibleProfile?.display_name} placeholder={t("Your name as a creator")} className={input} /></label>
            <label className="block text-sm text-zinc-300">{t("Introduction")}<textarea name="bio" maxLength={280} rows={3} defaultValue={visibleProfile?.bio ?? ''} placeholder={t("What do you share with your audience?")} className={input} /></label>
            <label className="block text-sm text-zinc-300">{t("Your website or social profile")}<input type="url" name="website" defaultValue={visibleProfile?.website ?? ''} placeholder="https://…" className={input} /></label>
            <div className="grid grid-cols-2 gap-4"><label className="block text-sm text-zinc-300">{t("Price in USDC")}<input name="price" type="number" min="1" max="10000" step="0.01" required defaultValue={(visibleProfile?.price_cents ?? 2500) / 100} className={input} /></label>
              <label className="block text-sm text-zinc-300">{t("Duration")}<select name="days" defaultValue={visibleProfile?.duration_days ?? 7} className={input}>{[7,14,30].map(days => <option value={days} key={days}>{days}{t(" days")}</option>)}</select></label></div>
            <label className="flex items-center gap-3 text-sm text-zinc-300"><input name="accepting" type="checkbox" defaultChecked={visibleProfile?.accepting ?? true} />{t("Accept brand requests")}</label>
            <p className="text-xs leading-5 text-zinc-400">{t("Price and duration changes apply to new proposals. Existing agreements keep their terms.")}</p>
            <button disabled={busy || !current || claimed.loading || !!claimed.error} className={`${button} w-full`}>{t("Save and publish my offer")}</button>
            </fieldset>
            {!wallet && <p className="text-sm text-zinc-400">{t("Connect your wallet to publish.")}</p>}
            {wallet && !current && <p className="text-sm text-zinc-400">{t("Select “Load my campaigns” to retrieve your offer or create a new one.")}</p>}
          </form>
          {visibleProfile && <Link href={`/creators/${visibleProfile.alias}`} className="mt-5 block break-all text-sm text-[#00F5A0]">{t("View public page · /creators/")}{visibleProfile.alias} ↗</Link>}
        </section>
        <section className={`${panel} order-1 min-w-0 xl:order-none`}><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{t("Your collaborations")}</h2><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-400">{current ? filteredCampaigns.length : '—'}</span></div>
          <div role="group" aria-label={t("Proposal type")} className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-black/20 p-1">{([{value:'creator',label:t('Received'),icon:ArrowDownLeft,count:received.length},{value:'brand',label:t('As a brand'),icon:ArrowUpRight,count:sent.length}] as const).map(item => <button key={item.value} aria-pressed={role === item.value} onClick={() => {setRole(item.value);setFilter('all');}} className={`flex items-center justify-center gap-2 rounded-lg px-2 py-3 text-xs font-medium ${role === item.value ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-zinc-300'}`}><item.icon size={15} aria-hidden="true" />{t(item.label)}<span className="text-[10px] opacity-50">{current ? item.count : '—'}</span></button>)}</div>
          <p className="mt-4 text-xs leading-6 text-zinc-400">{role === 'creator' ? t("Review brands that want to appear on your page.") : t("Follow proposals you sent to other creators. Pay after their approval.")}</p>
          <div role="group" aria-label={t("Filter campaigns by status")} className="mt-4 flex flex-wrap gap-2">{campaignFilters.map(item => <button key={item.value} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={`rounded-full border px-3 py-2 text-[11px] transition ${filter === item.value ? 'border-[#00F5A0]/25 bg-[#00F5A0]/10 text-[#00F5A0]' : 'border-white/10 text-zinc-400 hover:text-white'}`}>{t(item.label)}</button>)}</div>
          {visibleCampaigns.length === 100 && <p className="mt-4 text-xs text-zinc-400">{t("Showing your latest 100 campaigns.")}</p>}
          {busy && !current ? <LoadingState label={t("Loading your collaborations…")} /> : !filteredCampaigns.length && <div className="my-8 rounded-2xl border border-dashed border-white/10 p-6 text-center"><Inbox size={25} className="mx-auto mb-4 text-zinc-400" aria-hidden="true" /><p className="text-base font-medium">{!current ? t("Your agreements start here") : filter !== 'all' ? t("No campaigns with this status") : role === 'creator' ? t("Your next brand is still to come") : t("Your first proposal starts with a creator")}</p><p className="mt-3 text-xs leading-6 text-zinc-400">{!current ? !wallet ? t("Connect your wallet and load your campaigns to see private proposals.") : t("Load your campaigns with a wallet signature. This signature does not transfer funds.") : filter !== 'all' ? t("Try another filter to see your other collaborations.") : role === 'creator' ? t("Publish your offer and share your page to receive proposals.") : t("Visit a creator’s public page and send your proposal.")}</p>{current && filter !== 'all' && <button onClick={() => setFilter('all')} className="mt-4 text-xs text-violet-300">{t("View all statuses")}</button>}{current && filter === 'all' && role === 'creator' && visibleProfile && <Link href={`/creators/${visibleProfile.alias}`} className="mt-4 inline-block text-xs text-[#00F5A0]">{t("Open my public page ↗")}</Link>}</div>}
          <div className="mt-6 space-y-4">{filteredCampaigns.map(campaign => <article key={campaign.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="flex flex-wrap justify-between gap-2"><p className="min-w-0 break-words text-xs text-zinc-400">{role === 'creator' ? t('Proposal received') : t("Your proposal")} · {campaign.brand_name}</p><span className={`rounded-full px-3 py-1 text-[10px] ${statusColors[campaignState(campaign, now)]}`}>{t(statuses[campaignState(campaign, now)])}</span></div>
            <h3 className="mt-3 break-words text-lg font-semibold">{campaign.headline}</h3><p className="mt-2 break-words text-sm leading-6 text-zinc-400">{campaign.description}</p>
            <a href={campaign.destination_url} target="_blank" rel="noopener noreferrer sponsored" className="mt-3 block break-all text-sm text-violet-300">{campaign.destination_url} ↗</a>
            <p className="mt-4 font-semibold">{money(campaign.price_cents)}{t(" USDC ")}<span className="text-sm font-normal text-zinc-400">/ {campaign.duration_days}{t(" days")}</span></p>
            {campaign.ends_at && <p className="mt-2 text-xs text-zinc-400">{t("Ends: ")}{new Date(campaign.ends_at).toLocaleDateString(t.locale, { timeZone: 'America/Argentina/Buenos_Aires' })}</p>}
            {role === 'brand' && <p className="mt-2 break-all text-[10px] text-zinc-400" title={campaign.creator_wallet}>{t("Creator: ")}{campaign.creator_wallet.slice(0, 6)}…{campaign.creator_wallet.slice(-4)}</p>}
            <div className="mt-4 rounded-xl border border-white/5 bg-white/[.02] p-3"><p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{campaignState(campaign, now) === 'ended' || campaign.status === 'rejected' ? t('Agreement status') : t('Next step')}</p><p className="mt-1 text-xs leading-6 text-zinc-300">{t(nextCampaignAction(campaign, wallet, payment?.id === campaign.id, now))}</p></div>
            {canReview(campaign, wallet) && <div className="mt-4 flex flex-wrap gap-3"><button disabled={busy} className={button} onClick={() => void run(async () => { await signed('approve', { id: campaign.id }); await load(); }, t("Request approved. The brand can now pay."))}>{t("Approve ad")}</button><button disabled={busy} className="px-3 text-sm text-zinc-400" onClick={() => void run(async () => { await signed('reject', { id: campaign.id }); await load(); }, t("Request rejected."))}>{t("Reject")}</button></div>}
            {campaign.brand_wallet === wallet && campaign.status === 'approved' && <div className="mt-4 space-y-3">
              <p className="text-xs leading-5 text-zinc-400">{t("Direct payment to the creator, without escrow. You need test USDC and SOL for fees and account creation. If you already submitted payment, verify its signature before paying again.")}</p>
              <PaymentDisclosure />
              <button disabled={busy || payment?.id === campaign.id} className={button} onClick={() => void run(() => pay(campaign), t("Payment verified. Your ad is now published."))}>{t("Pay ")}{money(campaign.price_cents)}{t(" test USDC")}</button>
              <form key={`${campaign.id}:${payment?.id === campaign.id ? payment.signature : ''}`} onSubmit={event => retry(event, campaign.id)} className="space-y-2"><label className="block text-xs text-zinc-400">{t("Already paid? Transaction signature")}<input name="signature" required defaultValue={payment?.id === campaign.id ? payment.signature : ''} placeholder={t("Paste the signature to verify without paying again")} className={input} /></label><button disabled={busy} className="text-sm text-violet-300">{t("Verify existing payment ↗")}</button></form>
            </div>}
            {campaign.payment_signature && <a href={`https://explorer.solana.com/tx/${campaign.payment_signature}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="mt-4 block text-sm text-violet-300">{t("View payment on Solana ↗")}</a>}
          </article>)}</div>
        </section>
      </div>
      <footer className="pt-7 text-xs leading-6 text-zinc-400"><p>{t(SITE_MOTTO)}</p><p>{t("One agreement at a time. Publication starts when payment is verified on devnet.")}</p></footer>
    </div>
  </main></div>;
}
