# Creator image storage

Creator avatar and cover images selected in the editor stay in the local draft until the creator saves. `PATCH /api/profile` verifies the signed-in wallet, alias ownership, and request origin before any upload. It decodes and re-encodes PNG, JPEG and WebP files, checks the actual format against the declared MIME type, rejects corrupt or animated images, and enforces 1 MB and 6000 pixels per side limits. Encoding strips image metadata. Images that exceed 1 MB after processing are rejected too.

The server uploads to `creator-images/<wallet>/<random UUID>.<extension>` with overwrites disabled. The database stores public Storage URLs in the avatar/banner columns and design JSON. Existing inline images continue to render and migrate to Storage on the next successful profile save. A retained URL must belong to the same wallet, configured Supabase origin, and current saved image field; arbitrary URLs and other wallets' objects cannot be attached.

Profile writes compare the current `updated_at` value to prevent overlapping saves from overwriting each other. Failed saves attempt to remove their new objects. Before rollback after an attempted database write, the server re-reads the profile so that a lost response cannot delete a successfully committed image. A failed verification or delete logs a short event without file bytes, credentials, or paths. Replaced-image cleanup and durable orphan recovery are implemented in [migration 007 and the cleanup worker](creator-image-cleanup.md); hosted activation requires applying that migration.

## Setup

The existing server-only `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are sufficient. No new environment variables are needed. Apply migration 007 before deploying the cleanup-enabled image save code. Configure the bucket once with the existing environment-loading mechanism, from `front/`:

```bash
node --env-file=../.env.local --env-file-if-exists=.env.local --import tsx scripts/setup-creator-storage.ts
```

This idempotent command creates or updates only `creator-images`: public reads, 1 MB limit, and PNG/JPEG/WebP MIME allowlist. Do not add anonymous or authenticated Storage write policies. Wallet sessions are managed by the VYNX server; uploads use its private service key after ownership checks. Public buckets serve images to anyone with the URL, including after the creator unpublishes the page.

Supabase bucket restrictions complement application byte validation. See the [Supabase bucket configuration reference](https://supabase.com/docs/reference/javascript/storage-createbucket) and [Sharp decoder limits](https://sharp.pixelplumbing.com/api-constructor/).

## Verification

- `npm run check`: lint, typecheck, 61 unit/API tests and production build passed.
- `npm run test:e2e:registry`: six registry browser tests passed after the upload change.
- `npm run test:e2e`: eight browser tests passed against disposable Postgres with deterministic RPC and Storage HTTP fixtures. The creator flow exercises real application validation, upload, URL persistence, anonymous public reads and inline image replacement.
- API tests cover anonymous/cross-origin access, alias ownership, another wallet's objects, corrupt files, MIME spoofing, oversized dimensions/bytes, failed writes, save conflicts and a committed write with a lost response.

For a repeatable hosted smoke test, use the authenticated Vercel CLI and local devnet deployer:

```bash
node --env-file=../.env.local --env-file-if-exists=.env.local --import tsx scripts/smoke-creator-images.ts https://YOUR-PREVIEW.vercel.app https://vynx.me
```

The second URL is the target deployment's configured application origin; local `NEXT_PUBLIC_APP_URL` may differ. The test generates and funds a disposable devnet creator, signs a real wallet session, registers an alias with the preview's sponsored transaction, uploads an image, verifies its public URL and subsequent saves, and checks corrupt-file and anonymous rejection. It removes only its own profile, images and sessions afterward. The permanent devnet alias and payment audit remain. No existing creator card is edited.

Hosted verification completed on October 10, 2026 (America/Lima) against [this preview](https://vynx-7mbex4ock-fabohaxs-projects.vercel.app), real Solana devnet and hosted Supabase Storage. All six smoke checks passed, and test fixture cleanup completed. [Public test evidence](creator-image-storage-smoke.json) includes the real registration signature; no session tokens or secrets are recorded. Production frontend promotion remains part of the release checklist.
