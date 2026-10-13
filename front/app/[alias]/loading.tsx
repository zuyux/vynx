
import { CreatorCardSkeleton } from '@/components/CreatorCardSkeleton';

export default function Loading() {
  return <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#08080b] px-4 pb-5 text-white sm:px-6 sm:pb-7">
    <div aria-hidden="true" className="mt-2 mb-3 h-11" />
    <CreatorCardSkeleton />
  </main>;
}
