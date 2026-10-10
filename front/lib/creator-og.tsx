import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { storedCreatorImage, MAX_CREATOR_IMAGE_BYTES, MAX_CREATOR_IMAGE_DIMENSION } from './creator-image-policy';
import type { PublicCreator } from './public-creator';

// Only fetch portraits from our own public storage; legacy inline images also work.
export async function ogPortrait(value: string): Promise<string | null> {
  if (!value) return null;
  try {
    let bytes: Buffer;
    if (/^data:image\/(png|jpeg|webp);base64,/.test(value)) {
      bytes = Buffer.from(value.slice(value.indexOf(',') + 1), 'base64');
    } else {
      const storage = process.env.SUPABASE_URL;
      if (!storage || !storedCreatorImage(value) || new URL(value).origin !== new URL(storage).origin) return null;
      const response = await fetch(value, { redirect: 'error', signal: AbortSignal.timeout(5000), cache: 'no-store' });
      if (!response.ok || Number(response.headers.get('content-length')) > MAX_CREATOR_IMAGE_BYTES) return null;
      const chunks: Uint8Array[] = [];
      let total = 0;
      if (!response.body) return null;
      const reader = response.body.getReader();
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        total += chunk.length;
        if (total > MAX_CREATOR_IMAGE_BYTES) { await reader.cancel(); return null; }
        chunks.push(chunk);
      }
      bytes = Buffer.concat(chunks);
    }
    if (bytes.length > MAX_CREATOR_IMAGE_BYTES) return null;
    const image = sharp(bytes, { limitInputPixels: MAX_CREATOR_IMAGE_DIMENSION ** 2 });
    const png = await image.rotate().resize(600, 900, { fit: 'cover', position: 'north' }).png().toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch { return null; }
}

export function creatorOgImage(creator: PublicCreator, portrait: string | null) {
  const { design, alias } = creator;
  const accent = { mint: '#8cf4c5', violet: '#c4a2ff', rose: '#ffa5c9' }[design.accent];
  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#08080b', color: 'white', padding: 36, alignItems: 'center', gap: 64 }}>
      <div style={{ display: 'flex', position: 'relative', width: 345, height: 558, flexShrink: 0, borderRadius: 28, overflow: 'hidden', border: '1px solid #70528d', background: 'linear-gradient(145deg, #643676, #17131e)', flexDirection: 'column', justifyContent: 'flex-end' }}>
        {/* ImageResponse uses native image elements, not next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {portrait && <img src={portrait} alt="" width={345} height={558} style={{ position: 'absolute', inset: 0, objectFit: 'cover' }} />}
        <div style={{ display: 'flex', position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(23,19,30,0) 10%, rgba(23,19,30,0.5) 45%, #17131e 95%)' }} />
        <div style={{ display: 'flex', position: 'absolute', right: 18, top: 18, borderRadius: 30, background: '#17131ecc', padding: '8px 14px', fontSize: 18 }}>@{alias}</div>
        <div style={{ display: 'flex', flexDirection: 'column', padding: 24 }}>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, wordBreak: 'break-word' }}>{design.name}</div>
          <div style={{ display: 'flex', marginTop: 16, border: '1px solid #70528d', borderRadius: 14, padding: '14px 18px', color: accent, fontSize: 18 }}>View creator card ↗</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', width: 683 }}>
        <div style={{ display: 'flex', fontSize: 24, letterSpacing: 6, color: accent, marginBottom: 32 }}>VYNX</div>
        <div style={{ display: 'flex', fontSize: 54, fontWeight: 700, wordBreak: 'break-word', lineHeight: 1.1 }}>{design.name}</div>
        <div style={{ display: 'flex', fontSize: 28, color: accent, marginTop: 18 }}>@{alias}</div>
        <div style={{ display: 'flex', fontSize: 25, color: '#d0cad8', lineHeight: 1.4, marginTop: 28, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{design.bio.slice(0, 200) || `Support ${design.name} on VYNX.`}{design.bio.length > 200 ? '…' : ''}</div>
      </div>
    </div>,
    { width: 1200, height: 630, headers: { 'Cache-Control': 'no-store' } },
  );
}
