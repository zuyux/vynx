'use client';
import { useCopy } from "@/i18n/copy";


import { Heart } from '@/components/CardIcons';
import { PaymentDisclosure } from '@/components/PaymentDisclosure';
import { UserFacingError, userErrorMessage, responseError } from '@/lib/user-facing-error';

import { useState, type FormEvent } from 'react';
import { Transaction } from '@solana/web3.js';
import { ArrowUpRight, CircleCheck } from 'lucide-react';
import { useWalletSession } from '@/components/WalletSessionProvider';
import { confirmPayment } from '@/lib/payment-client';
import { tipCurrency, tipUsdcUnits, type TipCurrency } from '@/lib/tip-currency';

type PendingTip = { signature: string; amount: string; currency?: TipCurrency };
function WalletTipForm({ alias, creatorWallet, enabled }: { alias: string; creatorWallet: string; enabled: boolean }) {
  const t = useCopy();
  const session = useWalletSession();
  const [currency, setCurrency] = useState<TipCurrency>('USDC');
  const [amount, setAmount] = useState('1');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<PendingTip | null>(null);
  const [confirmed, setConfirmed] = useState<PendingTip | null>(null);
  async function post(path: string, payload: unknown) {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw responseError(response, result, t('Unable to complete the request. Please retry.'));
    return result;
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setNotice(''); setFailed(false); setConfirmed(null);
    let sent = false;
    try {
      if (!session.connectedWallet) { await session.authenticate(); return; }
      const authenticatedWallet = await session.ensureSession();
      if (authenticatedWallet !== session.connectedWallet) throw new UserFacingError(t('Reconnect your selected wallet before tipping.'));
      const key = `vynx:tip:${session.connectedWallet}:${alias}`;
      let recovery = pending;
      try { const saved = localStorage.getItem(key); if (saved) recovery = JSON.parse(saved); } catch { /* Manual signature verification remains available. */ }
      if (recovery) {
        const recoveredCurrency = tipCurrency(recovery.currency);
        setCurrency(recoveredCurrency); setAmount(recovery.amount);
        setPending(recovery); setNotice(t('Verifying your existing payment…'));
        await confirmPayment(() => post('/api/tips/confirm', { alias, ...recovery }));
        setConfirmed({ ...recovery, currency: recoveredCurrency });
      } else {
        tipUsdcUnits(amount);
        setNotice(t('Preparing your devnet tip…'));
        const payment = await post('/api/tips', { alias, amount, currency: 'USDC' });
        setNotice(t('Approve the transfer in your wallet…'));
        const transaction = Transaction.from(Uint8Array.from(atob(payment.transaction), character => character.charCodeAt(0)));
        const { signature } = await session.sendTransaction(transaction, session.connectedWallet);
        sent = true;
        const reference: PendingTip = { signature, amount, currency: 'USDC' };
        setPending(reference);
        try { localStorage.setItem(key, JSON.stringify(reference)); } catch { /* Keep the reference visible in the UI. */ }
        setNotice(t('Payment sent. Verifying on Solana…'));
        await confirmPayment(() => post('/api/tips/confirm', { alias, ...reference }));
        setConfirmed(reference);
      }
      setPending(null); setCurrency('USDC'); setAmount('1');
      try { localStorage.removeItem(key); } catch { /* Confirmation is idempotent. */ }
      setNotice('');
    } catch (reason) {
      if (reason instanceof Error && 'code' in reason && reason.code === 'PAYMENT_FAILED') {
        setPending(null); sent = false;
        try { localStorage.removeItem(`vynx:tip:${session.connectedWallet}:${alias}`); } catch { /* No transfer occurred in a failed transaction. */ }
      }
      setFailed(true); setNotice(`${userErrorMessage(reason, t('Tip failed.'))}${sent ? t(' Your payment was sent. Retry verification; do not send another transfer.') : ''}`);
    } finally { setBusy(false); }
  }
  return <section className="p-6 sm:p-8"><div aria-hidden="true" className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--card-accent-ink,#a78bfa)_30%,transparent)] bg-[color-mix(in_srgb,var(--offer-accent,#a78bfa)_10%,transparent)] text-[var(--card-accent-ink,#a78bfa)]"><Heart size={28} /></div><h2 className="text-xl font-semibold">{t("Support this creator")}</h2><p className="mt-2 text-sm leading-6 opacity-60">{t("Send ")}{currency}{t(" directly to the creator’s verified wallet. Solana devnet · test tokens.")}</p>
    {enabled ? <form onSubmit={event => void send(event)} className="mt-6 space-y-4">
      <p className="text-xs opacity-60">{t("USDC only · network fees sponsored · no SOL needed.")}</p>
      <PaymentDisclosure />
      <div role="group" aria-label={t("Tip presets")} className="flex flex-wrap gap-2">{['1', '5', '10'].map(value => <button type="button" key={value} disabled={busy || !!pending} aria-pressed={amount === value} onClick={() => setAmount(value)} className={`min-h-11 rounded-xl border px-4 py-2 text-sm ${amount === value ? 'border-[var(--card-accent-ink,#a78bfa)] bg-[color-mix(in_srgb,var(--offer-accent,#a78bfa)_10%,transparent)]' : 'border-current/15'}`}>{value} {currency}</button>)}</div>
      <label className="block text-sm">{t("Tip amount (")}{currency})<input name="amount" type="number" min="0.01" max="1000" step="0.000001" required disabled={busy || !!pending} value={amount} onChange={event => setAmount(event.target.value)} className="mt-2 w-full rounded-xl border border-current/15 bg-transparent px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--card-accent-ink,#a78bfa)]" /></label>
      <button disabled={busy || session.connectedWallet === creatorWallet} className="w-full rounded-xl bg-[var(--offer-accent,#a78bfa)] px-5 py-3 font-semibold text-[var(--offer-button-ink,#000000)] disabled:opacity-40">{busy ? t('Processing…') : pending ? t('Verify sent tip') : session.connectedWallet ? t("Send {v0} {v1} tip", {v0: amount, v1: currency}) : t('Connect wallet to tip')}</button>
      {session.connectedWallet === creatorWallet && <p className="text-xs opacity-60">{t("Use a different wallet to tip your own page.")}</p>}
    </form> : <p className="mt-6 text-sm opacity-60">{t("Tips are currently paused.")}</p>}
    {notice && <p role={failed ? 'alert' : 'status'} className={`mt-4 text-sm ${failed ? 'text-red-400' : 'text-emerald-500'}`}>{t(notice)}</p>}
    {confirmed && <div role="status" className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"><CircleCheck size={22} aria-hidden="true" /></span>
        <div className="min-w-0"><p className="font-semibold">{t("Tip confirmed")}</p><p className="mt-1 break-words text-sm opacity-80"><span className="font-medium">{confirmed.amount} {confirmed.currency ?? t('USDC')}</span>{t(" sent to @")}{alias}.</p><p className="mt-2 text-xs opacity-60">{t("Thank you for supporting this creator.")}</p></div>
      </div>
      <a className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium underline decoration-current/30 underline-offset-4 transition hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500" target="_blank" rel="noopener noreferrer" href={`https://explorer.solana.com/tx/${confirmed.signature}?cluster=devnet`}>{t("View transaction")}<ArrowUpRight size={16} aria-hidden="true" /><span className="sr-only">{t(" on Solana Explorer (opens in a new tab)")}</span></a>
    </div>}
    {pending?.signature && <a className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[var(--card-accent-ink,#a78bfa)]" target="_blank" rel="noopener noreferrer" href={`https://explorer.solana.com/tx/${pending.signature}?cluster=devnet`}>{t("View pending transaction")}<ArrowUpRight size={16} aria-hidden="true" /><span className="sr-only">{t(" on Solana Explorer (opens in a new tab)")}</span></a>}
  </section>;
}

export function TipForm(props: { alias: string; creatorWallet: string; enabled: boolean }) {
  const session = useWalletSession();
  return <WalletTipForm key={`${props.alias}:${session.connectedWallet || session.wallet}`} {...props} />;
}
