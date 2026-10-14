'use client';
import { useCopy } from "@/i18n/copy";


import { PaymentDisclosure } from '@/components/PaymentDisclosure';
import { UserFacingError, userErrorMessage, responseError } from '@/lib/user-facing-error';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import Link from '@/i18n/link';
import { LAMPORTS_PER_SOL, PublicKey, Transaction } from '@solana/web3.js';
import { BrandLogo } from '@/components/BrandLogo';
import SponsorshipWalletControl from '@/components/SponsorshipWalletControl';
import { useWalletSession } from '@/components/WalletSessionProvider';
import { useClaimedAlias } from '@/lib/use-claimed-alias';
import { normalizeAlias, safeDestination } from '@/lib/alias';
import { confirmPayment } from '@/lib/payment-client';
import { claimErrorMessage, type ClaimStage } from '@/lib/claim-errors';
import { aliasConnection } from '@/lib/alias-network';

function BuyAliasContent() {
  const t = useCopy();
  const params = useSearchParams();
  const router = useRouter();
  const session = useWalletSession();
  const [balanceSnapshot, setBalanceSnapshot] = useState<{ wallet: string; lamports: number | null; error: boolean } | null>(null);
  const balance = balanceSnapshot?.wallet === session.connectedWallet ? balanceSnapshot : null;
  useEffect(() => {
    const wallet = session.connectedWallet;
    if (!wallet) return;
    const controller = new AbortController();
    let connection: Awaited<ReturnType<typeof aliasConnection>> | undefined;
    let refreshing = false;
    async function refreshBalance() {
      if (refreshing || controller.signal.aborted) return;
      refreshing = true;
      try {
        connection ??= await aliasConnection({
          disableRetryOnRateLimit: true,
          fetch: (input, init) => fetch(input, {
            ...init,
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
            cache: 'no-store',
          }),
        });
        const lamports = await connection.getBalance(new PublicKey(wallet), 'confirmed');
        if (!controller.signal.aborted) setBalanceSnapshot({ wallet, lamports, error: false });
      } catch {
        if (!controller.signal.aborted) setBalanceSnapshot({ wallet, lamports: null, error: true });
      } finally {
        refreshing = false;
      }
    }
    void refreshBalance();
    const timer = setInterval(() => void refreshBalance(), 1000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [session.connectedWallet]);
  const [copyFeedback, setCopyFeedback] = useState<{ wallet: string; message: string } | null>(null);
  async function copyWalletAddress() {
    const wallet = session.connectedWallet;
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(wallet);
      setCopyFeedback({ wallet, message: t('Wallet address copied.') });
    } catch {
      setCopyFeedback({ wallet, message: t('Unable to copy. Select and copy the address above.') });
    }
  }
  const claimed = useClaimedAlias(session.wallet === session.connectedWallet ? session.wallet : '');
  useEffect(() => {
    if (claimed.alias && !claimed.error) router.replace(`/${encodeURIComponent(claimed.alias)}`);
  }, [claimed.alias, claimed.error, router]);
  const [alias, setAlias] = useState(params.get('alias') ?? '');
  const [quote, setQuote] = useState<{ alias: string; priceSol: string; priceLamports: string; priceVersion: string; sponsored: boolean; fullySponsored?: boolean } | null>(null);
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  const [quoteError, setQuoteError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const name = normalizeAlias(alias);
        const response = await fetch(`/api/actions/claim-alias?alias=${name}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        const result = await response.json();
        if (!response.ok) throw responseError(response, result, t('Unable to complete the request. Please retry.'));
        if (!controller.signal.aborted) { setQuote({ ...result, alias: name }); setQuoteError(''); }
      } catch (reason) {
        if (!controller.signal.aborted) { setQuote(null); setQuoteError(alias ? (userErrorMessage(reason, t('Unable to read pricing.'))) : ''); }
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [alias, quoteAttempt, t]);
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
    if (!response.ok) throw responseError(response, result, t('Unable to complete the request. Please retry.'));
    return result;
  }
  async function claim(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setNotice(''); setFailed(false);
    let stage: ClaimStage = 'sign-in';
    let reference = pending;
    try {
      if (!session.connectedWallet) { await session.authenticate(); return; }
      const authenticatedWallet = await session.ensureSession();
      if (authenticatedWallet !== session.connectedWallet) throw new UserFacingError(t('Reconnect the selected wallet before claiming.'));
      const key = `vynx:claim:${session.connectedWallet}`;
      try { const saved = localStorage.getItem(key); if (saved) reference = { ...JSON.parse(saved), wallet: session.connectedWallet }; } catch { /* The in-memory recovery remains available. */ }
      if (reference) setPending(reference);
      if (!reference) {
        stage = 'prepare';
        const name = normalizeAlias(alias);
        setNotice(t('Preparing your alias claim…'));
        if (!currentQuote) throw new UserFacingError(t('Wait for the on-chain quote before claiming.'));
        const payment = await post(`/api/actions/claim-alias?alias=${name}`, { account: session.connectedWallet, priceLamports: currentQuote.priceLamports, priceVersion: currentQuote.priceVersion });
        stage = 'send';
        setNotice(t('Sign the alias claim in your wallet…'));
        const tx = Transaction.from(Uint8Array.from(atob(payment.transaction), character => character.charCodeAt(0)));
        // The sponsor is the fee payer, so its signature is known before wallet
        // approval. Preserve it to recover an ambiguous send response.
        if (payment.signature) {
          reference = { wallet: session.connectedWallet, alias: name, signature: payment.signature };
          try { localStorage.setItem(key, JSON.stringify(reference)); } catch { /* In-memory recovery remains available. */ }
        }
        const { signature } = await session.sendTransaction(tx, session.connectedWallet);
        reference = { wallet: session.connectedWallet, alias: name, signature };
        setPending(reference);
        try { localStorage.setItem(key, JSON.stringify(reference)); } catch { /* The signature remains visible for recovery. */ }
      }
      setNotice(t('Claim sent. Verifying your alias…'));
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
      setFailed(true); setNotice(claimErrorMessage(reason, stage, !!reference, currentQuote?.priceSol, currentQuote?.sponsored, currentQuote?.fullySponsored)); }
    finally { setBusy(false); }
  }
  return <main id="main-content" tabIndex={-1} className="relative flex min-h-screen items-center justify-center bg-[#07070a] p-6 pt-20 text-white">{session.wallet && <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-20"><SponsorshipWalletControl iconOnly /></div>}<section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101015] p-8"><BrandLogo /><h1 className="mt-6 text-3xl font-semibold">{t("Claim your alias")}</h1>{params.get('welcome') === '1' && <p className="mt-3 text-sm leading-6 text-zinc-300">{t("Welcome to Vynx. Claim your unique @alias to create your creator card and give your audience a place to find you.")}</p>}<PaymentDisclosure /><p className="mt-3 text-sm leading-6 text-zinc-400">{t("One alias per wallet. ")}{currentQuote?.fullySponsored ? t("VYNX currently pays registration, account rent and network fees. Sign with your wallet or Privy to claim. No SOL needed.") : currentQuote ? t("Registration costs {v0} SOL on Solana devnet, including account rent. {v1}", {v0: currentQuote.priceSol, v1: currentQuote.sponsored ? 'VYNX pays network fees.' : 'Network fees are extra.'}) : t('Enter a 1–30 character alias to read its on-chain price.')}</p>
    {claimed.alias ? <div className="mt-6"><p>{t("Your wallet already owns @")}{claimed.alias}.</p><Link href="/dashboard/card" className="mt-5 inline-block rounded-xl bg-[#00F5A0] px-5 py-3 font-semibold text-black">{t("Edit my creator card")}</Link></div> : <form onSubmit={event => void claim(event)} className="mt-6 space-y-4"><label className="block text-sm">{t("Alias")}<input name="alias" required minLength={1} maxLength={30} disabled={busy || !!pending} value={alias} onChange={event => setAlias(event.target.value.toLowerCase())} placeholder="your_alias" className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 outline-none focus:border-[#00F5A0]" /></label><button type={session.connectedWallet ? 'submit' : 'button'} onClick={session.connectedWallet ? undefined : event => void claim(event)} disabled={busy || claimed.loading || !!claimed.error || (!!session.connectedWallet && !pending && !currentQuote)} className="w-full rounded-xl bg-[#00F5A0] px-5 py-3 font-semibold text-black disabled:opacity-40">{busy ? t('Processing…') : pending ? t('Verify alias payment') : session.connectedWallet ? currentQuote?.fullySponsored ? t("Claim alias for free") : t("Claim alias — {v0} SOL", {v0: currentQuote?.priceSol ?? '…'}) : t('Connect wallet')}</button></form>}
    {!currentQuote?.fullySponsored && <section aria-labelledby="wallet-funding-heading" className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
      <h2 id="wallet-funding-heading" className="text-sm font-semibold">{t("Your wallet · Solana devnet")}</h2>
      {session.connectedWallet ? <>
        <p className="mt-3 text-xs text-zinc-400">{t("Connected wallet address")}</p>
        <p className="mt-2 break-all font-mono text-sm text-zinc-200 select-all">{session.connectedWallet}</p>
        <p className="mt-3 text-sm text-zinc-200">{t("Balance: ")}<span className="font-mono font-medium">{balance?.error ? t('Unavailable') : balance?.lamports != null ? `${(balance.lamports / LAMPORTS_PER_SOL).toLocaleString(t.locale, { maximumFractionDigits: 9 })} SOL` : t('Loading…')}</span></p>
        <p className="mt-1 text-xs text-zinc-400">{balance?.error ? t('Unable to fetch balance. Retrying every second.') : t('Devnet balance refreshes every second.')}</p>
        <button type="button" onClick={() => void copyWalletAddress()} className="mt-3 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-[#00F5A0]">{t("Copy wallet address")}</button>
        {copyFeedback?.wallet === session.connectedWallet && <p role="status" className="mt-2 text-xs text-zinc-300">{t(copyFeedback.message)}</p>}
      </> : <p className="mt-3 text-sm text-zinc-400">{t("Connect your wallet to see the address to fund.")}</p>}
      <h3 className="mt-4 text-sm font-medium">{t("How to fund it")}</h3>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-300">
        <li>{t("Copy your connected wallet address.")}{session.connectedWallet && <><code className="mt-2 block break-all rounded-lg bg-black/30 p-3 text-xs text-zinc-200 select-all">{session.connectedWallet}</code><button type="button" onClick={() => void copyWalletAddress()} className="mt-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-[#00F5A0]">{t("Copy wallet address")}</button></>}</li>
        <li>{t("Open the ")}<a href="https://faucet.solana.com/" target="_blank" rel="noopener noreferrer" className="text-[#00F5A0] underline">{t("Solana faucet (opens in a new tab)")}</a>{t(", select Devnet, paste your address, and request free test SOL.")}</li>
        <li>{t("Wait for the SOL to arrive, then return here to claim your alias.")}{currentQuote ? t(" You need {v0} SOL{v1}", {v0: currentQuote.priceSol, v1: currentQuote.sponsored ? '; VYNX pays network fees.' : ' plus network fees.'}) : ''}</li>
      </ol>
      <p className="mt-3 text-xs leading-5 text-zinc-400">{t("Devnet SOL has no monetary value. Use devnet in your wallet when available. Do not send real SOL from an exchange or mainnet to fund this purchase.")}</p>
    </section>}
    {quoteError && <p role="alert" className="mt-4 text-sm text-red-200">{t(quoteError)} <button type="button" onClick={() => setQuoteAttempt(previous => previous + 1)} className="underline">{t("Retry pricing")}</button></p>}
    {notice && <p role={failed ? 'alert' : 'status'} className={`mt-4 text-sm ${failed ? 'text-red-200' : 'text-emerald-200'}`}>{t(notice)}</p>}
    {claimed.error && <p role="alert" className="mt-4 text-sm text-red-200">{t(claimed.error)} <button onClick={claimed.retry} className="underline">{t("Retry")}</button></p>}
    {pending && <p className="mt-4 break-all text-xs text-zinc-400">{t("Payment sent: ")}{pending.signature}{t(". Retry verification instead of paying again.")}</p>}
  </section></main>;
}
function BuyAliasFromParams() {
  const params = useSearchParams();
  return <BuyAliasContent key={params.get('alias') ?? ''} />;
}
export default function BuyAliasPage() {
  const t = useCopy(); return <Suspense fallback={<p role="status">{t("Loading claim…")}</p>}><BuyAliasFromParams /></Suspense>; }
