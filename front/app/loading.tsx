import { LoadingState } from '@/components/LoadingState';

export default function Loading() {
  return <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#07070a] py-8 text-white"><LoadingState fullPage /></main>;
}
