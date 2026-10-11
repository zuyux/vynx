import { appDb } from './app-db';
import { attendance, verifiedCompletion, type VideoEvent, type VideoRoom } from './daily-video';
import { ApiError } from './wallet-session';
import type { CreatorCallHistory } from './call-review';

type EvidenceRow = { id: string; starts_at: string; ends_at: string; room: VideoRoom | null; events: VideoEvent[] };
export function hasVerifiedAttendance(row: EvidenceRow) {
  if (!row.room || row.events.length >= 1000) return false;
  return verifiedCompletion(attendance(row.events, row.room, row.starts_at, row.ends_at), row.starts_at, row.ends_at).status === 'verified';
}
export async function creatorCallHistory(wallet: string, offset: number): Promise<CreatorCallHistory> {
  const db = appDb();
  const count = async () => {
    let total = 0, after: string | null = null;
    while (true) {
      const { data, error } = await db.rpc('creator_call_evidence', { creator: wallet, after_id: after }).abortSignal(AbortSignal.timeout(10_000));
      if (error || !Array.isArray(data)) throw new ApiError('Call history is unavailable.', 503);
      const rows = data as EvidenceRow[];
      total += rows.filter(hasVerifiedAttendance).length;
      if (rows.length < 50) return total;
      after = rows[rows.length - 1].id;
    }
  };
  const [verified_completed_calls, summary] = await Promise.all([
    count(), db.rpc('creator_review_summary', { creator: wallet, page_offset: offset }).abortSignal(AbortSignal.timeout(10_000)),
  ]);
  if (summary.error || !summary.data) throw new ApiError('Reviews are unavailable.', 503);
  return { ...summary.data, verified_completed_calls };
}
