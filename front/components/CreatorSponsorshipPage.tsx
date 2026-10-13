'use client';
import { useCopy } from "@/i18n/copy";

import { userErrorMessage } from '@/lib/user-facing-error';

import Link from '@/i18n/link';
import { BrandLogo } from '@/components/BrandLogo';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, RefreshCw, SearchX, WifiOff } from 'lucide-react';
import { useSponsorshipWallet } from '@/lib/use-sponsorship-wallet';
import { requestFields, type SponsorProfile } from '@/lib/sponsorship-domain';
import { CreatorPublicView, type PublicAd } from '@/components/CreatorPublicView';
import { readDraft, type CreatorDraft } from '@/lib/creator-draft';

type PageState = { profile: SponsorProfile; ad: PublicAd | null; design?: CreatorDraft } | { error: string; missing: boolean };

export default function CreatorSponsorshipPage({ alias }: { alias: string }) {
  const t = useCopy();
  const { signed } = useSponsorshipWallet();
  const [page, setPage] = useState<PageState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/sponsorships?alias=${encodeURIComponent(alias)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]), cache: 'no-store' })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) return { error: t("We could not load this space. Try again shortly."), missing: response.status === 404 || response.status === 400 };
        return {profile:result.profile,ad:result.ad,design:result.profile.design ? readDraft(JSON.stringify(result.profile.design)) : undefined};
      })
      .then(result => { if (!controller.signal.aborted) setPage(result); })
      .catch(() => { if (!controller.signal.aborted) setPage({error:t("We could not connect to the page. Check your connection and try again."),missing:false}); });
    return () => controller.abort();
  }, [alias, attempt, t]);

  useEffect(() => {
    if (!page || !('profile' in page) || !page.ad) return;
    const timer = setInterval(() => {
      setPage(previous => previous && 'profile' in previous && previous.ad && Date.parse(previous.ad.ends_at) <= Date.now() ? {...previous,ad:null} : previous);
    }, 1000);
    return () => clearInterval(timer);
  }, [page]);

  function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setNotice(''); setFailed(false);
    let fields;
    try { fields = requestFields({brand_name:data.get('brand_name'),headline:data.get('headline'),description:data.get('description'),destination_url:data.get('destination_url')}); }
    catch (reason) { setFailed(true); setNotice(userErrorMessage(reason, t("Review your proposal fields."))); return; }
    setBusy(true);
    void signed('request', {alias,...fields})
      .then(() => setNotice(t("Proposal sent. The creator will review it. You can follow it in My sponsorships before paying.")))
      .catch(reason => { setFailed(true); setNotice(userErrorMessage(reason, t("Could not send the proposal. Try again."))); })
      .finally(() => setBusy(false));
  }

  if (page && 'profile' in page) return <CreatorPublicView profile={page.profile} ad={page.ad} design={page.design} onRequest={request} busy={busy} notice={notice} failed={failed} />;
  return <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#07070a] px-5 py-7 text-white"><div className="mx-auto max-w-6xl"><nav className="flex items-center justify-between"><BrandLogo /><Link href="/dashboard" className="text-xs text-zinc-400">{t("My dashboard ↗")}</Link></nav>
    {page ? <section role="alert" className="mx-auto mt-16 max-w-lg rounded-3xl border border-white/10 bg-[#101015] p-8 text-center sm:mt-24 sm:p-12"><span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-300">{page.missing ? <SearchX size={28} /> : <WifiOff size={28} />}</span><p className="mt-6 break-all text-xs text-zinc-400">@{alias}</p><h1 className="mt-3 text-2xl font-semibold">{page.missing ? t("This space is not published yet") : t('We could not open this space')}</h1><p className="mt-4 text-sm leading-7 text-zinc-400">{page.missing ? t("Check the alias or return when the creator publishes their offer.") : page.error}</p><div className="mt-7 flex flex-wrap justify-center gap-3">{!page.missing && <button onClick={() => {setPage(null);setAttempt(value => value + 1);}} className="inline-flex items-center gap-2 rounded-xl bg-[#00F5A0] px-4 py-3 text-sm font-semibold text-black"><RefreshCw size={15} />{t("Retry")}</button>}<Link href="/dashboard/card" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm"><ArrowLeft size={15} />{t("Go to my page")}</Link></div></section> : <section role="status" aria-label={t("Loading the page for {v0}", {v0: alias})} className="mt-10 grid gap-7 lg:grid-cols-[1.35fr_1fr]"><div className="overflow-hidden rounded-3xl border border-white/10 bg-[#101015]"><div className="h-48 animate-pulse bg-white/5 motion-reduce:animate-none" /><div className="space-y-5 p-8"><div className="size-20 rounded-2xl bg-white/5" /><div className="h-8 w-2/3 rounded-lg bg-white/5" /><div className="h-16 rounded-lg bg-white/5" /><p className="text-sm text-zinc-400">{t("Loading the space for @")}{alias}…</p></div></div><div className="h-96 rounded-3xl border border-white/10 bg-[#101015] p-8"><div className="h-8 w-2/3 rounded-lg bg-white/5" /><div className="mt-8 h-48 rounded-xl bg-white/5" /></div></section>}
  </div></main>;
}
