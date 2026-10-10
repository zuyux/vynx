import type { SupabaseClient } from '@supabase/supabase-js';
import { CREATOR_IMAGE_BUCKET, ownedCreatorImagePath } from './creator-image-policy';
import { ApiError } from './wallet-session';

type CleanupJob = { object_url: string; wallet: string; attempts: number; lease_id: string };
export async function trackCreatorImageUpload(db: SupabaseClient, wallet: string, path: string) {
  const objectUrl = db.storage.from(CREATOR_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await db.from('creator_image_cleanup').upsert({ object_url: objectUrl, wallet, next_attempt_at: new Date(Date.now() + 60 * 60_000).toISOString() }, { onConflict: 'object_url', ignoreDuplicates: true });
  if (error) throw new ApiError('Image storage is temporarily unavailable. Your draft is preserved; retry saving shortly.', 503, 'IMAGE_CLEANUP_UNAVAILABLE');
}

export async function processCreatorImageCleanup(db: SupabaseClient, options: { wallet?: string; limit?: number } = {}) {
  const result = { deleted: 0, deferred: 0, failed: 0, blocked: 0 };
  let query = db.from('creator_image_cleanup').select('object_url,wallet').in('state', ['pending', 'deleting'])
    .lte('next_attempt_at', new Date().toISOString()).order('next_attempt_at').limit(Math.min(Math.max(options.limit ?? 20, 1), 200));
  if (options.wallet) query = query.eq('wallet', options.wallet);
  const { data: candidates, error } = await query;
  if (error) throw new ApiError('Image cleanup queue is unavailable.', 503);
  for (const candidate of candidates ?? []) {
    const path = ownedCreatorImagePath(candidate.object_url, candidate.wallet, process.env.SUPABASE_URL!);
    if (!path) {
      const { error: blockedError } = await db.from('creator_image_cleanup').update({ state: 'blocked', last_error_code: 'INVALID_OBJECT_REFERENCE' }).eq('object_url', candidate.object_url).eq('state', 'pending');
      if (blockedError) result.failed++; else result.blocked++;
      continue;
    }
    const { data, error: claimError } = await db.rpc('claim_creator_image_cleanup', { candidate_url: candidate.object_url });
    if (claimError) { result.failed++; continue; }
    if (!data) { result.deferred++; continue; }
    const job = data as CleanupJob;
    let failed = false;
    try { failed = !!(await db.storage.from(CREATOR_IMAGE_BUCKET).remove([path])).error; }
    catch { failed = true; }
    const changes = failed
      // Keep deleting while retrying so stale writes cannot reattach this URL.
      ? { next_attempt_at: new Date(Date.now() + Math.min(6 * 60, 2 ** Math.min(job.attempts, 9)) * 60_000).toISOString(), last_error_code: 'STORAGE_DELETE_FAILED' }
      : { state: 'deleted', deleted_at: new Date().toISOString(), last_error_code: null };
    const { error: finishError } = await db.from('creator_image_cleanup').update(changes).eq('object_url', job.object_url).eq('state', 'deleting').eq('lease_id', job.lease_id);
    if (failed || finishError) result.failed++; else result.deleted++;
  }
  return result;
}

export async function cleanupAfterCreatorSave(db: SupabaseClient, wallet: string) {
  try {
    const result = await processCreatorImageCleanup(db, { wallet, limit: 4 });
    if (result.failed || result.blocked) console.error(JSON.stringify({ event: 'creator_image_cleanup_pending', ...result }));
  } catch { console.error(JSON.stringify({ event: 'creator_image_cleanup_pending' })); }
}

// Optional operator backfill for objects created before upload manifests existed.
// Only canonical images older than the upload grace period enter the queue.
export async function discoverCreatorImageOrphans(db: SupabaseClient, limit = 100) {
  const storage = db.storage.from(CREATOR_IMAGE_BUCKET);
  const cap = Math.min(Math.max(limit, 1), 200);
  let queued = 0;
  for (let folderOffset = 0; queued < cap; folderOffset += 100) {
    const { data: folders, error } = await storage.list('', { limit: 100, offset: folderOffset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new ApiError('Unable to inspect image storage.', 503);
    for (const folder of folders ?? []) {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(folder.name)) continue;
      for (let offset = 0; queued < cap; offset += 100) {
        const { data: objects, error: listError } = await storage.list(folder.name, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
        if (listError) throw new ApiError('Unable to inspect image storage.', 503);
        for (const object of objects ?? []) {
          const age = Date.parse(object.created_at ?? '');
          const path = `${folder.name}/${object.name}`;
          const url = storage.getPublicUrl(path).data.publicUrl;
          if (!Number.isFinite(age) || age > Date.now() - 60 * 60_000 || !ownedCreatorImagePath(url, folder.name, process.env.SUPABASE_URL!)) continue;
          const { data: inserted, error: queueError } = await db.from('creator_image_cleanup').upsert({ object_url: url, wallet: folder.name }, { onConflict: 'object_url', ignoreDuplicates: true }).select('object_url');
          if (queueError) throw new ApiError('Unable to queue older images.', 503);
          queued += inserted?.length ?? 0;
          if (queued >= cap) break;
        }
        if ((objects?.length ?? 0) < 100) break;
      }
      if (queued >= cap) break;
    }
    if ((folders?.length ?? 0) < 100) break;
  }
  return { queued };
}
