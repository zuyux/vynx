export const CREATOR_IMAGE_BUCKET = 'creator-images';
export const MAX_CREATOR_IMAGE_BYTES = 1024 * 1024;
export const MAX_CREATOR_IMAGE_DIMENSION = 6000;
export const CREATOR_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'];

// Used when reading persisted designs in both the editor and public card.
export function storedCreatorImage(value: string) {
  try {
    const url = new URL(value);
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    return (url.protocol === 'https:' || local) && !url.username && !url.password && !url.search && !url.hash
      && /^\/storage\/v1\/object\/public\/creator-images\/[1-9A-HJ-NP-Za-km-z]{32,44}\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpeg|webp)$/.test(url.pathname);
  } catch { return false; }
}

export function ownedCreatorImagePath(value: string, wallet: string, supabaseUrl: string) {
  if (!storedCreatorImage(value)) return null;
  const url = new URL(value);
  const base = new URL(supabaseUrl);
  const prefix = `/storage/v1/object/public/${CREATOR_IMAGE_BUCKET}/${wallet}/`;
  return url.origin === base.origin && url.pathname.startsWith(prefix) && url.href === value
    ? url.pathname.slice(`/storage/v1/object/public/${CREATOR_IMAGE_BUCKET}/`.length) : null;
}

