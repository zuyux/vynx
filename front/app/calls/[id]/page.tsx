import PrivateCall from '@/components/PrivateCall';
export const metadata = { title: 'Videollamada privada | Vynx', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PrivateCall key={id} id={id} />;
}
