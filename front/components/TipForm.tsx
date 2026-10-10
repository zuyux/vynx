'use client';

import { sendDevnetTransaction } from '@/lib/devnet-wallet';
import { useState, type FormEvent } from 'react';
import { Transaction } from '@solana/web3.js';
import { useWalletSession } from '@/components/WalletSessionProvider';
import { useSolana } from '@phantom/react-sdk';
import { confirmPayment } from '@/lib/payment-client';
import { tipLamports } from '@/lib/sol-payment';
import { tipCurrency, tipUsdcUnits, type TipCurrency } from '@/lib/tip-currency';

type PendingTip = { signature: string; amount: string; currency?: TipCurrency };
function WalletTipForm({ alias, creatorWallet, enabled }: { alias: string; creatorWallet: string; enabled: boolean }) {
  const session = useWalletSession();
  const { solana } = useSolana();
  const [currency, setCurrency] = useState<TipCurrency>('USDC');
  const [amount, setAmount] = useState('1');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<PendingTip | null>(null);
  const [confirmed, setConfirmed] = useState('');
  async function post(path: string, payload: unknown) {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error), { code: result.code });
    return result;
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setNotice(''); setFailed(false);
    let sent = false;
    try {
      if (!session.connectedWallet) { await session.authenticate(); return; }
      await session.ensureSession();
      if (solana.publicKey !== session.connectedWallet) throw new Error('Reconnect your selected wallet before tipping.');
      const key = `vynx:tip:${session.connectedWallet}:${alias}`;
      let recovery = pending;
      try { const saved = localStorage.getItem(key); if (saved) recovery = JSON.parse(saved); } catch { /* Manual signature verification remains available. */ }
      if (recovery) {
        const recoveredCurrency = tipCurrency(recovery.currency);
        setCurrency(recoveredCurrency); setAmount(recovery.amount);
        setPending(recovery); setNotice('Verifying your existing payment…');
        await confirmPayment(() => post('/api/tips/confirm', { alias, ...recovery }));
        setConfirmed(recovery.signature);
      } else {
        if (currency === 'USDC') tipUsdcUnits(amount); else tipLamports(amount);
        setNotice('Preparing your devnet tip…');
        const payment = await post('/api/tips', { alias, amount, currency });
        setNotice('Approve the transfer in Phantom…');
        const transaction = Transaction.from(Uint8Array.from(atob(payment.transaction), character => character.charCodeAt(0)));
        const { signature } = await sendDevnetTransaction(transaction, session.connectedWallet);
        sent = true;
        const reference = { signature, amount, currency };
        setPending(reference);
        try { localStorage.setItem(key, JSON.stringify(reference)); } catch { /* Keep the reference visible in the UI. */ }
        setNotice('Payment sent. Verifying on Solana…');
        await confirmPayment(() => post('/api/tips/confirm', { alias, ...reference }));
        setConfirmed(signature);
      }
      setPending(null);
      try { localStorage.removeItem(key); } catch { /* Confirmation is idempotent. */ }
      setNotice('Tip confirmed. Thank you for supporting this creator!');
    } catch (reason) {
      if (reason instanceof Error && 'code' in reason && reason.code === 'PAYMENT_FAILED') {
        setPending(null); sent = false;
        try { localStorage.removeItem(`vynx:tip:${session.connectedWallet}:${alias}`); } catch { /* No transfer occurred in a failed transaction. */ }
      }
      setFailed(true); setNotice(`${reason instanceof Error ? reason.message : 'Tip failed.'}${sent ? ' Your payment was sent. Retry verification; do not send another transfer.' : ''}`);
    } finally { setBusy(false); }
  }
  return <section className="p-6 sm:p-8"><h2 className="text-xl font-semibold">Support this creator</h2><p className="mt-2 text-sm leading-6 opacity-60">Send {currency} directly to the creator’s verified wallet. Solana devnet · test tokens.</p>
    {enabled ? <form onSubmit={event => void send(event)} className="mt-6 space-y-4">
      <div role="group" aria-label="Tip currency" className="flex gap-2">{(['USDC', 'SOL'] as const).map(value => <button type="button" key={value} aria-label={value} disabled={busy || !!pending} aria-pressed={currency === value} onClick={() => { setCurrency(value); setAmount(value === 'USDC' ? '1' : '0.01'); }} className={`min-h-11 flex-1 rounded-xl border px-4 py-2 text-sm ${currency === value ? 'border-violet-400 bg-violet-400/10' : 'border-current/15'}`}>{value}{value === 'USDC' && <span className="ml-2 text-xs opacity-60">Recommended</span>}</button>)}</div>
      <p className="text-xs opacity-60">{currency === 'USDC' ? 'Network fees sponsored · no SOL needed.' : 'Your wallet pays the SOL network fee.'}</p>
      <div role="group" aria-label="Tip presets" className="flex flex-wrap gap-2">{(currency === 'USDC' ? ['1', '5', '10'] : ['0.01', '0.05', '0.1']).map(value => <button type="button" key={value} disabled={busy || !!pending} aria-pressed={amount === value} onClick={() => setAmount(value)} className={`min-h-11 rounded-xl border px-4 py-2 text-sm ${amount === value ? 'border-violet-400 bg-violet-400/10' : 'border-current/15'}`}>{value} {currency}</button>)}</div>
      <label className="block text-sm">Tip amount ({currency})<input name="amount" type="number" min={currency === 'USDC' ? '0.01' : '0.00001'} max={currency === 'USDC' ? '1000' : '10'} step={currency === 'USDC' ? '0.000001' : '0.000000001'} required disabled={busy || !!pending} value={amount} onChange={event => setAmount(event.target.value)} className="mt-2 w-full rounded-xl border border-current/15 bg-transparent px-4 py-3 outline-none focus:ring-2 focus:ring-violet-400" /></label>
      <button disabled={busy || session.connectedWallet === creatorWallet} className="w-full rounded-xl bg-violet-400 px-5 py-3 font-semibold text-black disabled:opacity-40">{busy ? 'Processing…' : pending ? 'Verify sent tip' : session.connectedWallet ? `Send ${amount} ${currency} tip` : 'Connect wallet to tip'}</button>
      {session.connectedWallet === creatorWallet && <p className="text-xs opacity-60">Use a different wallet to tip your own page.</p>}
    </form> : <p className="mt-6 text-sm opacity-60">Tips are currently paused.</p>}
    {notice && <p role={failed ? 'alert' : 'status'} className={`mt-4 text-sm ${failed ? 'text-red-400' : 'text-emerald-500'}`}>{notice}</p>}
    {(pending?.signature || confirmed) && <a className="mt-3 block break-all text-xs underline" target="_blank" rel="noopener noreferrer" href={`https://explorer.solana.com/tx/${pending?.signature || confirmed}?cluster=devnet`}>View transaction: {pending?.signature || confirmed}</a>}
  </section>;
}

export function TipForm(props: { alias: string; creatorWallet: string; enabled: boolean }) {
  const session = useWalletSession();
  return <WalletTipForm key={`${props.alias}:${session.connectedWallet || session.wallet}`} {...props} />;
}
