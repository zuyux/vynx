'use client';
import { useCopy } from "@/i18n/copy";


import Link from '@/i18n/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Transaction } from '@solana/web3.js';
import { useWalletSession } from './WalletSessionProvider';
import { callPrice } from '@/lib/call-offer';
import type { CreatorOffer } from '@/lib/creator-draft';
import { MONTHLY_POLICY, renewalAvailable, type MonthlyInvoice, type MonthlySession, type MonthlySnapshot, type MonthlySubscription } from '@/lib/monthly-offer';
import { sessionAvailabilityLabel, sessionDurationLabel } from '@/lib/offer-terms';
import { confirmPayment } from '@/lib/payment-client';
import { responseError, UserFacingError, userErrorMessage } from '@/lib/user-facing-error';

const button = 'min-h-11 rounded-xl border border-current/20 px-4 py-3 text-sm font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-violet-400';
async function requestMonthly(body: Record<string, unknown>) {
  const response = await fetch('/api/monthly-offers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw responseError(response, result, 'Could not update your monthly plan. Your payment reference is preserved.');
  return result as { invoice?: MonthlyInvoice; subscription?: MonthlySubscription; transaction?: string };
}
function formatDate(instant: string, timezone: string | undefined, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', ...(timezone ? { timeZone: timezone } : {}) }).format(new Date(instant));
}
type Recovery = { sending?: boolean; signature?: string };
function InvoicePayment({ invoice, subscription, onChange }: { invoice: MonthlyInvoice; subscription: MonthlySubscription; onChange: () => Promise<void> }) {
  const t = useCopy();
  const session = useWalletSession();
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [signature, setSignature] = useState('');
  const inFlight = useRef(false);
  const storageKey = `vynx:monthly:v1:${session.wallet}:${invoice.id}`;
  async function perform(action: 'pay' | 'verify' | 'recover') {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setNotice('');
    try {
      const wallet = await session.ensureSession();
      if (wallet !== session.wallet) throw new UserFacingError(t('Your wallet changed. Reload the plan before continuing.'));
      const saved = localStorage.getItem(storageKey);
      let recovery: Recovery = saved ? JSON.parse(saved) : {};
      const suppliedSignature = signature.trim() || recovery.signature;
      if (suppliedSignature) {
        await confirmPayment(() => requestMonthly({ action: 'confirm', invoice: invoice.id, signature: suppliedSignature }));
        localStorage.setItem(storageKey, JSON.stringify({ signature: suppliedSignature }));
        setNotice(t('Monthly payment confirmed. Your month and sessions are active.'));
        await onChange(); return;
      }
      if (action === 'verify') throw new UserFacingError(t('Paste the payment signature from your wallet to verify it.'));
      if (action === 'recover') {
        const result = await requestMonthly({ action: 'recover', invoice: invoice.id });
        if (result.invoice?.state === 'paid') setNotice(t('Your existing payment was found and confirmed.'));
        else { localStorage.removeItem(storageKey); setNotice(t('No payment landed. The expired reservation was released; you can request a new month.')); }
        await onChange(); return;
      }
      if (recovery.sending) throw new UserFacingError(t('A payment may already have been submitted. Verify its wallet signature or recover the expired payment before paying again.'));
      const result = await requestMonthly({ action: 'checkout', invoice: invoice.id });
      if (result.invoice?.state === 'paid') { await onChange(); return; }
      if (!result.transaction) throw new UserFacingError(t('Could not prepare payment. Retry this invoice.'));
      const transaction = Transaction.from(Uint8Array.from(atob(result.transaction), character => character.charCodeAt(0)));
      localStorage.setItem(storageKey, JSON.stringify({ sending: true }));
      let paymentSignature: string;
      try { ({ signature: paymentSignature } = await session.sendTransaction(transaction, wallet)); }
      catch (reason) {
        // Clear only a definite rejection. Network errors retain the recovery guard.
        const message = userErrorMessage(reason, '');
        if (message === 'Wallet approval was cancelled. Try again when you are ready.') localStorage.removeItem(storageKey);
        throw reason;
      }
      recovery = { sending: true, signature: paymentSignature };
      localStorage.setItem(storageKey, JSON.stringify(recovery)); setSignature(paymentSignature);
      await confirmPayment(() => requestMonthly({ action: 'confirm', invoice: invoice.id, signature: paymentSignature }));
      setNotice(t('Monthly payment confirmed. Your month and sessions are active.'));
      await onChange();
    } catch (reason) { setNotice(userErrorMessage(reason, t('Could not finish. Keep the wallet signature and retry verification without paying again.'))); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div className="mt-4 space-y-3 rounded-xl border border-violet-400/30 p-4">
    <p className="text-sm font-medium">{t("Payment requested: ")}{callPrice(invoice.price_units)}{t(" USDC for this month")}</p>
    <p className="text-xs leading-6 opacity-70">{formatDate(invoice.period_start, undefined, t.locale)} – {formatDate(invoice.period_end, undefined, t.locale)}{t(". This payment goes directly to the creator. Every new month requires your wallet approval. Solana devnet test tokens; your wallet covers network fees and any token-account deposit.")}</p>
    {!subscription.stopped_at && <button type="button" disabled={busy} className={`${button} w-full bg-[var(--offer-accent,#a78bfa)] text-[var(--offer-button-ink,#000000)]`} onClick={() => void perform('pay')}>{busy ? t('Processing…') : t("Approve and pay {v0} USDC for this month", {v0: callPrice(invoice.price_units)})}</button>}
    <label className="block text-xs">{t("Payment signature to recover this invoice")}<input value={signature} onChange={event => setSignature(event.target.value)} disabled={busy} className="mt-2 min-h-11 w-full min-w-0 rounded-lg border border-current/20 bg-transparent px-3 py-2" /></label>
    <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} className={button} onClick={() => void perform('verify')}>{t("Verify existing payment")}</button><button type="button" disabled={busy} className={button} onClick={() => void perform('recover')}>{t("Recover or reset expired payment")}</button></div>
    {notice && <p role="status" className="break-words text-sm">{t(notice)}</p>}
  </div>;
}
function SessionList({ sessions, timezone }: { sessions: MonthlySession[]; timezone?: string }) {
  const t = useCopy();
  return <ul className="mt-3 space-y-2">{sessions.map(item => <li key={item.id} className="rounded-lg border border-current/10 p-3 text-xs"><span>{formatDate(item.starts_at, timezone, t.locale)} – {new Intl.DateTimeFormat(t.locale, { timeStyle: 'short', ...(timezone ? { timeZone: timezone } : {}) }).format(new Date(item.ends_at))}{timezone ? ` (${timezone})` : ''} · {t(item.state.replaceAll('_', ' '))}</span>{item.state === 'confirmed' && <Link href={`/calls/${item.id}`} className="mt-2 block text-violet-300 underline">{t("Open private call")}</Link>}</li>)}</ul>;
}
export default function MonthlyPlans({ alias, offer, creatorWallet }: { alias?: string; offer?: CreatorOffer; creatorWallet?: string }) {
  const t = useCopy();
  const session = useWalletSession();
  const [snapshot, setSnapshot] = useState<{ wallet: string; checkedAt: number; data: MonthlySnapshot } | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [accepted, setAccepted] = useState(false);
  const [stopping, setStopping] = useState<string | null>(null);
  const walletRef = useRef(session.wallet);
  useEffect(() => { walletRef.current = session.wallet; }, [session.wallet]);
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (!session.wallet) return;
    const wallet = session.wallet;
    const response = await fetch(`/api/monthly-offers${alias ? t("?alias={v0}", {v0: encodeURIComponent(alias)}) : ''}`, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw responseError(response, result, t('Could not load your monthly plans.'));
    if (walletRef.current === wallet) { setSnapshot({ wallet, checkedAt: Date.now(), data: result }); setError(''); }
  }, [session.wallet, alias, t]);
  useEffect(() => {
    if (!session.wallet) return;
    let cancelled = false;
    const load = () => void refresh().catch(reason => { if (!cancelled) setError(userErrorMessage(reason, t('Could not load monthly plans.'))); });
    load(); const interval = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [session.wallet, refresh, t]);
  const loaded = snapshot?.wallet === session.wallet ? snapshot.data : null;
  const plans = loaded?.subscriptions.filter(plan => !offer || plan.offer_key === offer.id) ?? [];
  const paidAccess = plans.some(plan => plan.role === 'fan' && plan.paid_until && Date.parse(plan.paid_until) > (snapshot?.checkedAt ?? 0));
  const current = plans.find(plan => !plan.stopped_at && plan.role === 'fan');
  const owner = creatorWallet === session.wallet || plans.some(plan => plan.role === 'creator');
  async function reserve(subscription?: MonthlySubscription) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const wallet = await session.ensureSession();
      if (wallet !== session.wallet) throw new UserFacingError(t('Your wallet changed. Reload before requesting a month.'));
      if (!subscription && !accepted) throw new UserFacingError(t('Accept the monthly payment terms first.'));
      await requestMonthly({ action: 'reserve', accepted_policy: MONTHLY_POLICY, ...(subscription ? { subscription: subscription.id } : { alias, offer: offer?.id }) });
      await refresh(); setNotice(t('Review this month’s dates and sessions, then approve its payment.'));
    } catch (reason) { setError(userErrorMessage(reason, t('Could not reserve this month. Retry the same plan.'))); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function stop(id: string) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      if (await session.ensureSession() !== session.wallet) throw new UserFacingError(t('Reload your plan after changing wallets.'));
      await requestMonthly({ action: 'stop', subscription: id }); await refresh(); setStopping(null);
      setNotice(t('Renewals stopped. Your already-paid month and sessions remain available.'));
    } catch (reason) { setError(userErrorMessage(reason, t('Could not stop renewals. Retry.'))); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <section aria-label={offer ? t("Monthly plan: {v0}", {v0: offer.title}) : t('Monthly plans')} className="space-y-4">
    <div><h2 className="text-xl font-semibold">{offer?.title ?? t('Monthly plans and payments')}</h2><p className="mt-2 text-sm leading-6 opacity-70">{t("Each month requires a new payment approval. Renewals open 7 days before the due date. An unpaid month does not activate sessions.")}</p></div>
    {offer && <div className="rounded-xl border border-current/15 p-4"><p>{offer.price}{t(" USDC / month")}{offer.durationMinutes ? t(" · {v0} per session", {v0: sessionDurationLabel(offer.durationMinutes, t.locale)}) : ''}</p>{offer.description && <p className="mt-2 whitespace-pre-line text-sm opacity-70">{offer.description}</p>}{offer.schedule?.length ? <p className="mt-2 text-xs leading-6">{t("Available: ")}{offer.schedule.map(item => sessionAvailabilityLabel(item, offer.durationMinutes ?? 30, t.locale)).join(' · ')} ({offer.timezone}{t("), every week")}</p> : null}</div>}
    {!session.wallet ? <button type="button" disabled={session.checking} className={`${button} bg-[var(--offer-accent,#a78bfa)] text-[var(--offer-button-ink,#000000)]`} onClick={() => void session.authenticate().catch(reason => setError(userErrorMessage(reason, t('Could not connect your wallet.'))))}>{t("Connect wallet to manage monthly payments")}</button> : <>
      {!loaded && !error && <p role="status" className="text-sm">{t("Loading monthly plans…")}</p>}
      {offer && owner && <Link href="/dashboard/monthly" className="inline-flex min-h-11 items-center text-sm text-violet-300 underline">{t("Manage my customers and monthly payments")}</Link>}
      {offer && loaded && !current && !owner && !paidAccess && <div className="space-y-3"><label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={accepted} disabled={busy} onChange={event => setAccepted(event.target.checked)} className="mt-1 size-4 shrink-0" /><span>{t("I agree to pay ")}{offer.price}{t(" test USDC for each month I approve. Payments go directly to the creator. The listed sessions repeat weekly, and refunds must be arranged with the creator.")}</span></label><button type="button" className={`${button} w-full bg-[var(--offer-accent,#a78bfa)] text-[var(--offer-button-ink,#000000)]`} disabled={busy || !accepted} onClick={() => void reserve()}>{busy ? t('Reserving…') : t('Review and reserve my first month')}</button></div>}
      {loaded && !plans.length && !offer && <p className="text-sm opacity-70">{t("Your monthly plans, renewal requests, and payment history will appear here.")}</p>}
      {plans.map(plan => {
        const invoices = loaded!.invoices.filter(item => item.subscription_id === plan.id);
        const pending = invoices.find(item => item.state === 'awaiting_payment');
        const due = renewalAvailable(plan, snapshot?.checkedAt ?? 0);
        return <article key={plan.id} className="min-w-0 rounded-2xl border border-current/15 p-4">
          <h3 className="font-semibold">{t(plan.terms.title)} · @{plan.creator_alias}</h3><p className="mt-2 text-sm">{callPrice(plan.price_units)}{t(" USDC / month · ")}{plan.role === 'creator' ? t('Creator') : t('Customer')}</p>
          <p className="mt-2 text-sm">{plan.stopped_at ? t('Renewals stopped') : plan.paid_until ? `${due ? t('Renewal payment requested') : t('Next payment due')}: ${formatDate(plan.paid_until, undefined, t.locale)}` : t('First monthly payment pending')}</p>
          {plan.role === 'fan' && !pending && due && <button type="button" disabled={busy} className={`${button} mt-3 bg-[var(--offer-accent,#a78bfa)] text-[var(--offer-button-ink,#000000)]`} onClick={() => void reserve(plan)}>{t("Review and pay next month")}</button>}
          {pending && <><p className="mt-3 text-sm">{t("Reserved month: ")}{formatDate(pending.period_start, undefined, t.locale)} – {formatDate(pending.period_end, undefined, t.locale)}</p><details className="mt-3"><summary className="cursor-pointer text-sm">{t("Review all ")}{loaded!.sessions.filter(item => item.monthly_invoice_id === pending.id).length}{t(" scheduled sessions")}</summary><SessionList sessions={loaded!.sessions.filter(item => item.monthly_invoice_id === pending.id)} timezone={plan.terms.timezone} /></details>{plan.role === 'fan' ? <InvoicePayment key={`${session.wallet}:${pending.id}`} invoice={pending} subscription={plan} onChange={refresh} /> : <p className="mt-3 text-xs opacity-70">{t("Awaiting the customer’s wallet payment approval.")}</p>}</>}
          <details className="mt-4"><summary className="cursor-pointer text-sm">{t("Payment history and sessions (")}{invoices.filter(item => item.state === 'paid').length}{t(" paid months)")}</summary><div className="mt-3 space-y-3">{invoices.map(invoice => <div key={invoice.id} className="rounded-xl border border-current/10 p-3 text-xs"><p>{formatDate(invoice.period_start, undefined, t.locale)} – {formatDate(invoice.period_end, undefined, t.locale)} · {callPrice(invoice.price_units)}{t(" USDC · ")}{t(invoice.state.replaceAll('_', ' '))}</p>{invoice.payment_signature && <p className="mt-2 break-all opacity-70">{t("Payment signature: ")}{invoice.payment_signature}</p>}<SessionList sessions={loaded!.sessions.filter(item => item.monthly_invoice_id === invoice.id)} timezone={plan.terms.timezone} /></div>)}</div></details>
          {plan.role === 'fan' && !plan.stopped_at && <div className="mt-4">{stopping === plan.id ? <><p className="mb-2 text-xs">{t("Stop future renewals? Paid sessions remain available.")}</p><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} className={button} onClick={() => void stop(plan.id)}>{t("Confirm stop renewals")}</button><button type="button" disabled={busy} className={button} onClick={() => setStopping(null)}>{t("Keep plan")}</button></div></> : <button type="button" disabled={busy} className={button} onClick={() => setStopping(plan.id)}>{t("Stop renewals")}</button>}</div>}
        </article>;
      })}
    </>}
    {notice && <p role="status" className="text-sm">{t(notice)}</p>}{error && <div role="alert"><p className="text-sm text-red-300">{t(error)}</p><button type="button" disabled={busy} className={`${button} mt-2`} onClick={() => void refresh().catch(reason => setError(userErrorMessage(reason, t('Could not reload monthly plans.'))))}>{t("Reload monthly plans")}</button></div>}
  </section>;
}
