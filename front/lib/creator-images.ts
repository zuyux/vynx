import { trackCreatorImageUpload, cleanupAfterCreatorSave } from './creator-image-cleanup';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from './wallet-session';
import { CREATOR_IMAGE_BUCKET, MAX_CREATOR_IMAGE_BYTES, MAX_CREATOR_IMAGE_DIMENSION, ownedCreatorImagePath } from './creator-image-policy';

export async function validatedCreatorImage(value: string) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 || match[2].length > Math.ceil(MAX_CREATOR_IMAGE_BYTES / 3) * 4) throw new ApiError('Choose a JPG, PNG or WebP image up to 1 MB.');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > MAX_CREATOR_IMAGE_BYTES) throw new ApiError('Choose an image up to 1 MB.', 413);
  try {
    const image = sharp(bytes, { limitInputPixels: MAX_CREATOR_IMAGE_DIMENSION ** 2, failOn: 'warning' });
    const metadata = await image.metadata();
    if (metadata.format !== match[1] || !metadata.width || !metadata.height || metadata.width > MAX_CREATOR_IMAGE_DIMENSION || metadata.height > MAX_CREATOR_IMAGE_DIMENSION || (metadata.pages ?? 1) > 1) throw Error('Invalid image');
    // Decode/re-encode the full raster, stripping metadata and trailing payloads.
    const clean = await image.rotate().toFormat(match[1] as 'png' | 'jpeg' | 'webp').toBuffer();
    if (clean.length > MAX_CREATOR_IMAGE_BYTES) throw new ApiError('The processed image exceeds 1 MB. Choose a smaller image.', 413);
    return { bytes: clean, extension: match[1], contentType: `image/${match[1]}` };
  } catch (reason) {
    if (reason instanceof ApiError) throw reason;
    throw new ApiError('Use a valid, non-animated JPG, PNG or WebP image up to 6000 pixels per side.');
  }
}

export { ownedCreatorImagePath } from './creator-image-policy';

export async function persistCreatorImage(db: SupabaseClient, wallet: string, value: string, current: string | null, uploaded: string[]) {
  if (!value) return '';
  const storage = db.storage.from(CREATOR_IMAGE_BUCKET);
  if (!value.startsWith('data:')) {
    if (!ownedCreatorImagePath(value, wallet, process.env.SUPABASE_URL!) || value !== current) throw new ApiError('This image does not belong to the current saved profile. Choose a new image.', 403);
    return value;
  }
  const image = await validatedCreatorImage(value);
  const path = `${wallet}/${randomUUID()}.${image.extension}`;
  await trackCreatorImageUpload(db, wallet, path);
  const { error } = await storage.upload(path, image.bytes, { contentType: image.contentType, cacheControl: '31536000', upsert: false });
  if (error) throw new ApiError('Image storage is unavailable. Your draft is preserved; retry saving.', 503, 'IMAGE_UPLOAD_FAILED');
  uploaded.push(path);
  return storage.getPublicUrl(path).data.publicUrl;
}

export async function removeUncommittedImages(db: SupabaseClient, paths: string[]) {
  if (!paths.length) return;
  const wallets = new Set<string>();
  try {
    for (const path of paths) {
      const wallet = path.split('/')[0];
      const objectUrl = db.storage.from(CREATOR_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
      if (!ownedCreatorImagePath(objectUrl, wallet, process.env.SUPABASE_URL!)) continue;
      const { error } = await db.from('creator_image_cleanup').update({ next_attempt_at: new Date().toISOString() }).eq('object_url', objectUrl).eq('state', 'pending');
      if (error) throw error;
      wallets.add(wallet);
    }
    for (const wallet of wallets) await cleanupAfterCreatorSave(db, wallet);
  } catch { console.error(JSON.stringify({ event: 'creator_image_rollback_deferred', count: paths.length })); }
}
