import { PRIVATE_METADATA } from '@/lib/seo';

// Creator search results point to the primary /[alias] card. These auxiliary
// sponsorship forms load client-side and should not index their loading states.
export const metadata = PRIVATE_METADATA;
export default function CreatorsLayout({ children }: { children: React.ReactNode }) { return children; }
