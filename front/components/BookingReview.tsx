'use client';
import { useCopy } from "@/i18n/copy";


import { useEffect, useState, type FormEvent } from 'react';
import { useWalletSession } from './WalletSessionProvider';
import { responseError, userErrorMessage } from '@/lib/user-facing-error';
import { REVIEW_SCORES, type CallReview } from '@/lib/call-review';

const labels = { overall_rating: 'Overall rating', punctuality: 'Punctuality', communication: 'Communication', fulfillment: 'Fulfillment of the offered service' };
export default function BookingReview({ id }: { id: string }) {
  const t = useCopy();
  const session = useWalletSession();
  const [result, setResult] = useState<{ wallet: string; review: CallReview | null; eligible: boolean } | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const wallet = session.wallet;
    if (!wallet) return;
    void fetch(`/api/call-reviews?id=${encodeURIComponent(id)}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw responseError(response, data, t('Could not load your review.'));
        if (!controller.signal.aborted) { setResult({ wallet, ...data }); setError(''); }
      }).catch(reason => { if (!controller.signal.aborted) setError(userErrorMessage(reason, t('Could not load your review.'))); });
    return () => controller.abort();
  }, [id, session.wallet, retry, t]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const ratings = Object.fromEntries(REVIEW_SCORES.map(field => [field, Number(fields.get(field))]));
    const expectedWallet = session.wallet;
    setBusy(true); setError('');
    try {
      const wallet = await session.ensureSession();
      if (wallet !== expectedWallet) throw new Error(t('Wallet changed. Reload your review.'));
      const response = await fetch('/api/call-reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...ratings, comment: fields.get('comment') }) });
      const data = await response.json();
      if (!response.ok) throw responseError(response, data, t('Could not submit the review.'));
      setResult({ wallet, eligible: false, review: data.review });
    } catch (reason) { setError(userErrorMessage(reason, t('Could not submit the review. Retry with the same feedback.'))); }
    finally { setBusy(false); }
  }
  const loaded = result?.wallet === session.wallet ? result : null;
  return <section aria-labelledby="booking-review-title" className="mt-6 rounded-2xl border border-white/15 p-5">
    <h2 id="booking-review-title" className="text-xl font-semibold">{t("Your call review")}</h2>
    {loaded?.review ? <div role="status" className="mt-3">
      <p>{t("Review submitted · ")}{loaded.review.overall_rating}{t("/5 overall")}</p>
      <p className="mt-2 whitespace-pre-wrap break-words">{loaded.review.comment}</p>
    </div> : loaded?.eligible ? <form onSubmit={event => void submit(event)} className="mt-4 space-y-4">
      <p className="text-sm text-zinc-300">{t("One review per completed booking. Your ratings and comment will appear on the public Creator Card. They are separate from attendance verification and escrow decisions.")}</p>
      <div className="grid gap-4 sm:grid-cols-2">{REVIEW_SCORES.map(field => <div key={field} className="text-sm">
        <label htmlFor={`review-${field}`}>{t(labels[field])}</label>
        <select id={`review-${field}`} name={field} required defaultValue="" disabled={busy} className="mt-2 block w-full rounded-lg border border-white/20 bg-zinc-900 p-3 text-white">
          <option value="" disabled>{t("Choose a rating")}</option>
          {[1,2,3,4,5].map(score => <option key={score} value={score}>{score} / 5{score === 1 ? t(' · Poor') : score === 5 ? t(' · Excellent') : ''}</option>)}
        </select>
      </div>)}</div>
      <label className="block text-sm">{t("Comment")}<textarea name="comment" required maxLength={2000} rows={4} disabled={busy} className="mt-2 block w-full rounded-lg border border-white/20 bg-zinc-900 p-3" /></label>
      <button disabled={busy} className="rounded-xl bg-violet-400 px-5 py-3 font-semibold text-black disabled:opacity-50">{busy ? t('Submitting…') : t('Submit review')}</button>
    </form> : <p role="status" className="mt-3 text-sm">{loaded ? t('Reviews are available after you acknowledge completion of a paid booking.') : t('Loading your review…')}</p>}
    {error && <div className="mt-3"><p role="alert" className="text-red-300">{t(error)}</p>{!loaded && <button onClick={() => setRetry(value => value + 1)} className="mt-2 underline">{t("Retry")}</button>}</div>}
  </section>;
}
