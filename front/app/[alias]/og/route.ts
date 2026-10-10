import { publicCreator } from '@/lib/public-creator';
import { creatorOgImage, ogPortrait } from '@/lib/creator-og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ alias: string }> }) {
  const creator = await publicCreator((await params).alias);
  if (!creator || creator.published === false) return new Response('Creator not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return creatorOgImage(creator, await ogPortrait(creator.design.avatar));
}
