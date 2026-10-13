'use client';

import { useEffect, useRef, useState } from 'react';
import { Transaction } from '@solana/web3.js';
import { useWalletSession } from './WalletSessionProvider';
import type { CreatorOffer } from '@/lib/creator-draft';
import { OFFER_PAYMENT_POLICY, offerPriceUnits, type OfferPurchase } from '@/lib/offer-purchase';
import { callPrice } from '@/lib/call-offer';
import { sessionAvailabilityLabel } from '@/lib/offer-terms';
import { confirmPayment } from '@/lib/payment-client';
import { responseError, UserFacingError, userErrorMessage } from '@/lib/user-facing-error';

type Recovery = { id: string; sending?: boolean; signature?: string };
const button = 'min-h-11 rounded-xl border border-current/20 px-4 py-3 text-sm disabled:opacity-50';
async function requestPurchase(body: Record<string, unknown>) {
  const response = await fetch('/api/offer-purchases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw responseError(response, result, 'Could not finish this offer payment. Keep your payment reference.');
  return result as { purchase: OfferPurchase; transaction?: string };
}
export default function OfferCheckout({ alias, offer, creatorWallet }: { alias: string; offer: CreatorOffer; creatorWallet: string }) {
  const session = useWalletSession();
  const wallet = session.connectedWallet || session.wallet;
  const [receipt, setReceipt] = useState<{ wallet: string; purchase: OfferPurchase } | null>(null);
  const [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const inFlight = useRef(false);
  const purchase = receipt?.wallet === wallet ? receipt.purchase : null;
  const storageKey = (payer: string) => `vynx:offer:v1:${payer}:${alias}:${offer.id}`;
  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;
    void (async () => {
      const saved = localStorage.getItem(`vynx:offer:v1:${wallet}:${alias}:${offer.id}`);
      if (!saved) return;
      const recovery: Recovery = JSON.parse(saved);
      const result = await requestPurchase({ action: 'status', id: recovery.id });
      if (!cancelled) { setReceipt({ wallet, purchase: result.purchase }); }
    })().catch(reason => { if (!cancelled) setNotice(userErrorMessage(reason, 'Could not recover your payment reference.')); });
    return () => { cancelled = true; };
  }, [wallet, alias, offer.id]);
  async function perform() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setNotice('');
    try {
      if (!session.connectedWallet) { await session.authenticate(); return; }
      const payer = await session.ensureSession();
      if (payer !== wallet) throw new UserFacingError('Your wallet changed. Review the offer again before paying.');
      const key = storageKey(payer), saved = localStorage.getItem(key);
      let recovery: Recovery = saved ? JSON.parse(saved) : { id: crypto.randomUUID() };
      const suppliedSignature = recovery.signature;
      if (suppliedSignature) {
        const result = await confirmPayment(() => requestPurchase({ action: 'confirm', id: recovery.id, signature: suppliedSignature }));
        localStorage.setItem(key, JSON.stringify({ id: recovery.id, signature: suppliedSignature }));
        setReceipt({ wallet: payer, purchase: result.purchase }); setNotice('Payment confirmed. Your receipt is saved in Vynx.'); return;
      }
      if (recovery.sending) {
        let result;
        try { result = await requestPurchase({ action: 'recover', id: recovery.id }); }
        catch (reason) {
          if (reason instanceof UserFacingError && reason.code === 'PAYMENT_PENDING') throw new UserFacingError('A transfer may already have been submitted. Wait a moment and retry; Vynx will check it before another payment.');
          throw reason;
        }
        localStorage.setItem(key, JSON.stringify({ id: recovery.id, ...(result.purchase.payment_signature ? { signature: result.purchase.payment_signature } : {}) }));
        setReceipt({ wallet: payer, purchase: result.purchase });
        setNotice(result.purchase.state === 'paid' ? 'Your existing payment was found and confirmed.' : 'No transfer landed. You can approve this payment again.'); return;
      }
      if (!accepted) throw new UserFacingError('Accept the offer payment terms first.');
      localStorage.setItem(key, JSON.stringify(recovery));
      const result = await requestPurchase({ action: 'checkout', id: recovery.id, alias, offer: offer.id, expected_price_units: offerPriceUnits(offer.price), accepted_policy: OFFER_PAYMENT_POLICY });
      setReceipt({ wallet: payer, purchase: result.purchase });
      if (result.purchase.state === 'paid') { setNotice('This offer payment is already confirmed.'); return; }
      if (!result.transaction) throw new UserFacingError('Could not prepare this payment. Retry the same reference.');
      const transaction = Transaction.from(Uint8Array.from(atob(result.transaction), character => character.charCodeAt(0)));
      localStorage.setItem(key, JSON.stringify({ ...recovery, sending: true }));
      let paymentSignature: string;
      try { ({ signature: paymentSignature } = await session.sendTransaction(transaction, payer)); }
      catch (reason) {
        if (userErrorMessage(reason, '') === 'Wallet approval was cancelled. Try again when you are ready.') localStorage.setItem(key, JSON.stringify({ id: recovery.id }));
        throw reason;
      }
      recovery = { id: recovery.id, sending: true, signature: paymentSignature };
      localStorage.setItem(key, JSON.stringify(recovery));
      const confirmed = await confirmPayment(() => requestPurchase({ action: 'confirm', id: recovery.id, signature: paymentSignature }));
      setReceipt({ wallet: payer, purchase: confirmed.purchase }); setNotice('Payment confirmed. Your receipt is saved in Vynx.');
    } catch (reason) { setNotice(userErrorMessage(reason, 'Could not finish. Retry this checkout to check your existing payment.')); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const paid = purchase?.state === 'paid', terms = purchase?.terms ?? offer;
  return <section aria-label={`Offer payment: ${offer.title}`} className="space-y-4">
    <h2 className="text-xl font-semibold">{terms.title}</h2>
    {terms.description && <p className="whitespace-pre-line text-sm opacity-80">{terms.description}</p>}
    <p className="font-medium">{purchase ? callPrice(purchase.price_units) : terms.price} USDC · one-time payment</p>
    {terms.type === 'bookings' && !!terms.schedule?.length && <p className="text-sm leading-6">Available hours: {terms.schedule.map(item => sessionAvailabilityLabel(item, terms.durationMinutes ?? 30)).join(' · ')} ({terms.timezone})</p>}
    <p className="text-xs leading-6 opacity-70">Pay through Vynx directly to the creator’s wallet. Solana devnet test tokens; your wallet covers network fees and any token-account deposit. Delivery and refunds are arranged with the creator.</p>
    {terms.type === 'bookings' && <p className="text-sm">This payment is for one session. Arrange its date and time with the creator; this checkout does not reserve a call.</p>}
    {paid ? <div role="status" className="rounded-xl border border-emerald-400/30 p-4 text-emerald-300">Payment confirmed<p className="mt-2 break-all text-xs">Receipt: {purchase.id}</p></div> : <>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={accepted} disabled={busy} onChange={event => setAccepted(event.target.checked)} className="mt-1 size-4 shrink-0" /><span>I agree to pay {purchase ? callPrice(purchase.price_units) : terms.price} test USDC to the creator for this offer.</span></label>
      <button type="button" disabled={busy || wallet === creatorWallet || (!!session.connectedWallet && !accepted)} onClick={() => void perform()} className={`${button} w-full bg-violet-400 font-semibold text-black`}>{busy ? 'Processing…' : session.connectedWallet ? `Approve and pay ${purchase ? callPrice(purchase.price_units) : terms.price} USDC` : 'Connect wallet to pay'}</button>
      {wallet === creatorWallet && <p className="text-xs opacity-70">Use a different wallet to purchase your own offer.</p>}
    </>}
    {notice && <p role="status" className="break-words text-sm">{notice}</p>}
    {purchase?.payment_signature && <a className="block break-all text-xs underline" target="_blank" rel="noopener noreferrer" href={`https://explorer.solana.com/tx/${purchase.payment_signature}?cluster=devnet`}>View payment transaction</a>}
  </section>;
}
