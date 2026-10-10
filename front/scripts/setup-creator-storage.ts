import { appDb } from '../lib/app-db';
import { CREATOR_IMAGE_BUCKET, MAX_CREATOR_IMAGE_BYTES, CREATOR_IMAGE_MIMES } from '../lib/creator-image-policy';
async function main() {
  const db = appDb();
  const options = { public: true, fileSizeLimit: MAX_CREATOR_IMAGE_BYTES, allowedMimeTypes: CREATOR_IMAGE_MIMES };
  const { data: buckets, error } = await db.storage.listBuckets();
  if (error) throw Error('Unable to inspect Storage. Check the server-only Supabase configuration.');
  const existing = buckets.find(bucket => bucket.id === CREATOR_IMAGE_BUCKET);
  const result = existing ? await db.storage.updateBucket(CREATOR_IMAGE_BUCKET, options) : await db.storage.createBucket(CREATOR_IMAGE_BUCKET, options);
  if (result.error) throw Error('Unable to configure creator image storage.');
  console.log('creator-images configured: public reads; PNG/JPEG/WebP; 1 MB maximum.');
}
main().catch(reason => { console.error(reason.message); process.exitCode = 1; });
