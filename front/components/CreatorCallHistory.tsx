'use client';

import { useEffect, useState } from 'react';
import type { CreatorCallHistory as History } from '@/lib/call-review';
import { responseError, userErrorMessage } from '@/lib/user-facing-error';

export default function CreatorCallHistory({ alias }: { alias: string }) {
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/creator-history?alias=${encodeURIComponent(alias)}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw responseError(response, data, 'Call history is unavailable.');
        if (!controller.signal.aborted) { setHistory(data); setError(''); }
      }).catch(reason => { if (!controller.signal.aborted) setError(userErrorMessage(reason, 'Call history is unavailable.')); });
    return () => controller.abort();
  }, [alias, retry]);
  async function more() {
    if (!history || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/creator-history?alias=${encodeURIComponent(alias)}&offset=${history.comments.length}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw responseError(response, data, 'Could not load more reviews.');
      setHistory(previous => previous ? { ...data, comments: [...previous.comments, ...data.comments] } : data);
    } catch (reason) { setError(userErrorMessage(reason, 'Could not load more reviews.')); }
    finally { setBusy(false); }
  }
  if ((!history && !error) || (history?.verified_completed_calls === 0 && history.review_count === 0)) return null;
  return <section aria-labelledby="creator-history-title" className="mt-6 rounded-2xl border border-current/15 p-5">
    <h2 id="creator-history-title" className="text-xl font-semibold">Call history &amp; reviews</h2>
    {history ? <>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
        <div><dt className="opacity-70">Verified completed calls</dt><dd className="mt-2 text-xl font-semibold">{history.verified_completed_calls}</dd></div>
        <div><dt className="opacity-70">Average rating</dt><dd className="mt-2 text-xl font-semibold">{history.average_rating === null ? 'Not rated' : `${history.average_rating.toFixed(1)}/5`}</dd></div>
        <div><dt className="opacity-70">Reviews</dt><dd className="mt-2 text-xl font-semibold">{history.review_count}</dd></div>
      </dl>
      <p className="mt-4 text-xs leading-5 opacity-70">Verified calls require both participants to attend together for at least 90% of the booked duration. Ratings reflect paying fans’ feedback and are separate from attendance verification.</p>
      {history.review_count === 0 && <p className="mt-4 text-sm">No reviews yet. Feedback will appear here after paying fans review their completed bookings.</p>}
      <ul className="mt-4 space-y-4">{history.comments.map((review, index) => <li key={`${review.created_at}:${index}`} className="border-t border-current/15 pt-4">
        <p className="text-sm font-semibold">Paying fan · {review.overall_rating}/5 overall</p>
        <p className="mt-1 text-xs opacity-70"><time dateTime={review.created_at}>{review.created_at.slice(0,10)}</time> · Punctuality {review.punctuality}/5 · Communication {review.communication}/5 · Service fulfillment {review.fulfillment}/5</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{review.comment}</p>
      </li>)}</ul>
      {history.has_more && <button disabled={busy} onClick={() => void more()} className="mt-4 min-h-11 rounded-xl border border-current/20 px-4 py-2 text-sm disabled:opacity-50">{busy ? 'Loading…' : 'More reviews'}</button>}
    </> : null}
    {error && <div className="mt-4"><p role="alert" className="text-sm">{error}</p>{!history && <button onClick={() => setRetry(value => value + 1)} className="mt-2 min-h-11 underline">Retry</button>}</div>}
  </section>;
}
