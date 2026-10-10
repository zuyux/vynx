'use client';

import { sendDevnetTransaction } from '@/lib/devnet-wallet';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Transaction } from '@solana/web3.js';
import { useSolana } from '@phantom/react-sdk';
import { BrandLogo } from '@/components/BrandLogo';
import { useWalletSession } from '@/components/WalletSessionProvider';
import { useClaimedAlias } from '@/lib/use-claimed-alias';
import { normalizeAlias, safeDestination } from '@/lib/alias';
import { confirmPayment } from '@/lib/payment-client';
import { claimErrorMessage, type ClaimStage } from '@/lib/claim-errors';

function BuyAliasContent() {
  const params = useSearchParams();
  const router = useRouter();
  const session = useWalletSession();
  const { solana } = useSolana();
  const claimed = useClaimedAlias(session.wallet || session.connectedWallet);
  useEffect(() => {
    if (claimed.alias && !claimed.error) router.replace(`/${encodeURIComponent(claimed.alias)}`);
  }, [claimed.alias, claimed.error, router]);
  const [alias, setAlias] = useState(params.get('alias') ?? '');
  const [quote, setQuote] = useState<{ alias: string; priceSol: string; priceLamports: string; priceVersion: string; sponsored: boolean } | null>(null);
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  const [quoteError, setQuoteError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const name = normalizeAlias(alias);
        const response = await fetch(`/api/actions/claim-alias?alias=${name}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (!controller.signal.aborted) { setQuote({ ...result, alias: name }); setQuoteError(''); }
      } catch (reason) {
        if (!controller.signal.aborted) { setQuote(null); setQuoteError(alias ? (reason instanceof Error ? reason.message : 'Unable to read pricing.') : ''); }
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [alias, quoteAttempt]);
  const currentQuote = quote?.alias === alias.trim().replace(/^@/, '').toLowerCase() ? quote : null;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);
  const [pendingSnapshot, setPending] = useState<{ wallet: string; alias: string; signature: string } | null>(null);
  const pending = pendingSnapshot?.wallet === session.connectedWallet ? pendingSnapshot : null;
  useEffect(() => {
    const wallet = session.connectedWallet;
    const controller = new AbortController();
    if (!wallet) return;
    const timer = setTimeout(async () => {
      try {
        const saved = localStorage.getItem(`vynx:claim:${wallet}`);
        if (saved) {
          const receipt = JSON.parse(saved);
          if (typeof receipt.alias === 'string' && typeof receipt.signature === 'string') { setPending({ ...receipt, wallet }); setAlias(receipt.alias); }
        } else if (session.wallet === wallet) {
          const response = await fetch('/api/actions/claim-alias/pending', { signal: controller.signal });
          if (response.ok) {
            const { pending: receipt } = await response.json();
            if (receipt && !controller.signal.aborted) { setPending({ ...receipt, wallet }); setAlias(receipt.alias); }
          }
        }
      } catch { /* A damaged local receipt must not prevent signing in. */ }
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [session.connectedWallet, session.wallet]);
  async function post(path: string, body: unknown) {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error), { code: result.code });
    return result;
  }
  async function claim(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setNotice(''); setFailed(false);
    let stage: ClaimStage = 'sign-in';
    let reference = pending;
    try {
      if (!session.connectedWallet) { await session.authenticate(); return; }
      await session.ensureSession();
      if (solana.publicKey !== session.connectedWallet) throw new Error('Reconnect the selected wallet before claiming.');
      const key = `vynx:claim:${session.connectedWallet}`;
      try { const saved = localStorage.getItem(key); if (saved) reference = { ...JSON.parse(saved), wallet: session.connectedWallet }; } catch { /* The in-memory recovery remains available. */ }
      if (reference) setPending(reference);
      if (!reference) {
        stage = 'prepare';
        const name = normalizeAlias(alias);
        setNotice('Preparing your devnet alias payment…');
        if (!currentQuote) throw new Error('Wait for the on-chain quote before claiming.');
        const payment = await post(`/api/actions/claim-alias?alias=${name}`, { account: session.connectedWallet, priceLamports: currentQuote.priceLamports, priceVersion: currentQuote.priceVersion });
        stage = 'send';
        setNotice('Approve the alias payment in Phantom…');
        const tx = Transaction.from(Uint8Array.from(atob(payment.transaction), character => character.charCodeAt(0)));
        // The sponsor is the fee payer, so its signature is known before wallet
        // approval. Preserve it to recover an ambiguous send response.
        if (payment.signature) {
          reference = { wallet: session.connectedWallet, alias: name, signature: payment.signature };
          try { localStorage.setItem(key, JSON.stringify(reference)); } catch { /* In-memory recovery remains available. */ }
        }
        const { signature } = await sendDevnetTransaction(tx, session.connectedWallet);
        reference = { wallet: session.connectedWallet, alias: name, signature };
        setPending(reference);
        try { localStorage.setItem(key, JSON.stringify(reference)); } catch { /* The signature remains visible for recovery. */ }
      }
      setNotice('Payment sent. Verifying your alias…');
      stage = 'verify';
      const receipt = reference;
      await confirmPayment(() => post(`/api/actions/claim-alias/confirm?alias=${receipt.alias}`, { account: session.connectedWallet, signature: receipt.signature }));
      try { localStorage.removeItem(key); } catch { /* Server confirmation is idempotent. */ }
      setNotice(`@${reference.alias} claimed! Opening your profile editor…`);
      setPending(null);
      router.replace(safeDestination(params.get('next') ?? '/dashboard/card')); router.refresh();
    } catch (reason) {
      const code = reason && typeof reason === 'object' && 'code' in reason ? reason.code : undefined;
      if (code === 'PRICE_CHANGED' || code === 'QUOTE_EXPIRED') { setQuote(null); setQuoteAttempt(previous => previous + 1); }
      const rejected = code === 4001 || code === '4001' || code === 'USER_CANCELLED' || (reason instanceof Error && /user rejected|cancelled|canceled/i.test(reason.message));
      if (rejected || code === 'QUOTE_EXPIRED' || code === 'PAYMENT_FAILED' || code === 'WALLET_DEVNET_UNAVAILABLE') {
        reference = null; setPending(null);
        try { localStorage.removeItem(`vynx:claim:${session.connectedWallet}`); } catch { /* A failed transaction transferred no funds. */ }
      }
      if (reference) setPending(reference);
      setFailed(true); setNotice(claimErrorMessage(reason, stage, !!reference, currentQuote?.priceSol, currentQuote?.sponsored)); }
    finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#07070a] p-6 text-white"><section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101015] p-8"><BrandLogo /><h1 className="mt-6 text-3xl font-semibold">Claim your alias</h1><p className="mt-3 text-sm leading-6 text-zinc-400">One alias per wallet. {currentQuote ? `Registration costs ${currentQuote.priceSol} SOL on Solana devnet, including account rent. ${currentQuote.sponsored ? 'VYNX pays network fees.' : 'Network fees are extra.'}` : 'Enter a 1–30 character alias to read its on-chain price.'}</p>
    {claimed.alias ? <div className="mt-6"><p>Your wallet already owns @{claimed.alias}.</p><Link href="/dashboard/card" className="mt-5 inline-block rounded-xl bg-[#00F5A0] px-5 py-3 font-semibold text-black">Edit my creator card</Link></div> : <form onSubmit={event => void claim(event)} className="mt-6 space-y-4"><label className="block text-sm">Alias<input name="alias" required minLength={1} maxLength={30} disabled={busy || !!pending} value={alias} onChange={event => setAlias(event.target.value.toLowerCase())} placeholder="your_alias" className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 outline-none focus:border-[#00F5A0]" /></label><button disabled={busy || claimed.loading || !!claimed.error || (!!session.connectedWallet && !pending && !currentQuote)} className="w-full rounded-xl bg-[#00F5A0] px-5 py-3 font-semibold text-black disabled:opacity-40">{busy ? 'Processing…' : pending ? 'Verify alias payment' : session.connectedWallet ? `Claim alias — ${currentQuote?.priceSol ?? '…'} SOL` : 'Connect wallet'}</button></form>}
    {quoteError && <p role="alert" className="mt-4 text-sm text-red-200">{quoteError} <button type="button" onClick={() => setQuoteAttempt(previous => previous + 1)} className="underline">Retry pricing</button></p>}
    {notice && <p role={failed ? 'alert' : 'status'} className={`mt-4 text-sm ${failed ? 'text-red-200' : 'text-emerald-200'}`}>{notice}</p>}
    {claimed.error && <p role="alert" className="mt-4 text-sm text-red-200">{claimed.error} <button onClick={claimed.retry} className="underline">Retry</button></p>}
    {pending && <p className="mt-4 break-all text-xs text-zinc-400">Payment sent: {pending.signature}. Retry verification instead of paying again.</p>}
  </section></main>;
}
export default function BuyAliasPage() { return <Suspense fallback={<p role="status">Loading claim…</p>}><BuyAliasContent /></Suspense>; }
