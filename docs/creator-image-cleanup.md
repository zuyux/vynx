# Creator image cleanup

Apply migration `007_creator_image_cleanup.sql` after 001–006 before deploying this change. The Supabase service API key cannot execute SQL migrations. Use your existing database migration connection, the Supabase dashboard SQL Editor, or the Management API with a project-scoped personal access token granting Database read-write permission. Keep the management token local and outside application configuration.

The migration adds a service-only cleanup queue, profile reference guards and atomic cleanup claims. Replacing or removing an avatar/cover, or deleting a creator/sponsorship profile, queues old URLs in the same transaction as the profile write. Saves then process up to four due jobs for that wallet. A cleanup outage never turns a successful profile save into a failure.

New uploads are registered before Storage upload with a one-hour grace period. This recovers objects left behind by interrupted uploads/saves. Workers check avatar/banner columns and design JSON across **all** creator and sponsorship profiles. Referenced files are retained and checked again later; unpublished profiles are included. Inline images, foreign origins, malformed paths and other-wallet objects never reach Storage deletion. Invalid queue entries are blocked for operator review.

The worker obtains a database lease while holding the same advisory lock used by reference-writing triggers. Once deletion starts, writes cannot reattach that URL. Workers retain deletion tombstones to reject stale drafts. A crashed worker's lease expires after five minutes; deletion is idempotent. Storage failures remain in the deleting state, blocking resurrection, with exponential retries from two minutes up to six hours. Jobs are retried on subsequent saves or by the operator command below; no scheduled worker is installed by this change. Do not purge deleting/deleted tombstones or manually override their state.

## Operator commands

From `front/`, with the existing server-only Supabase configuration:

```bash
# Process up to 100 due jobs; repeat as part of regular maintenance.
node --env-file=../.env.local --env-file-if-exists=.env.local --import tsx scripts/cleanup-creator-images.ts 100

# Also discover canonical files older than one hour that predate upload tracking.
node --env-file=../.env.local --env-file-if-exists=.env.local --import tsx scripts/cleanup-creator-images.ts 100 --discover
```

Discovery is limited to the creator-images bucket and canonical wallet/UUID raster paths. It queues candidates; the atomic database reference check decides whether deletion is allowed. Fresh or undated objects and unknown paths are skipped. Current images remain protected. Discovery uses bounded batches (1–200); previously tracked objects are skipped, so repeated runs progress through older untracked files.

Failed/blocked batches exit nonzero and print aggregate counts only. Inspect `creator_image_cleanup` with a server role for `last_error_code` (`STORAGE_DELETE_FAILED` or `INVALID_OBJECT_REFERENCE`) and `next_attempt_at`. Resolve Storage availability issues and retry when due. A failure to record completion after a successful deletion is retried safely because the URL stays blocked and deleting a missing object is harmless.

## Deployment and verification

1. Apply [migration 007](../front/supabase/migrations/007_creator_image_cleanup.sql). No new environment variables or bucket policy changes are needed.
2. Run `npm run check` and both browser suites.
3. Deploy a Vercel preview and run the hosted image smoke test. Verify old image objects disappear after replacement and the new image still renders.
4. Run discovery for older objects, review blocked results, then promote only after preview verification.

Local verification covers atomic queueing, shared sponsorship references, expired leases, competing workers, stale-reference rejection, image removal, delete failure/retry, expired upload reclamation and anonymous access denial. The normal creator browser flow also verifies that replacing an image removes the old object while preserving the new image.

## Current verification status

- Local `npm run check` passed: lint, typecheck, 71 unit/API tests and production build.
- Ten browser/integration tests and six registry browser tests passed, applying migration 007 to disposable Postgres.
- Migration 007 is active in hosted Supabase, verified through the service API on 2026-10-10.
- [Preview build](https://vynx-k1zydyshi-fabohaxs-projects.vercel.app) passed the hosted smoke test: authenticated upload, public image/card rendering, URL persistence, corrupt-file and anonymous rejection, replacement deleting the old object while preserving the new one, and removal deleting the replacement object. See [evidence](creator-image-cleanup-smoke.json).
- Older-object discovery queued zero untracked candidates; the cleanup batch reported zero failures or blocked jobs.
- Production has not been promoted. Retries run on subsequent saves or through the operator command; regular scheduled maintenance remains an operational follow-up.
