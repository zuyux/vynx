import { Sidebar } from '@/components/Sidebar';
import MonthlyPlans from '@/components/MonthlyPlans';

export default function MonthlyPage() {
  return <div className="min-h-screen bg-[#08080b] text-white"><Sidebar /><main id="main-content" tabIndex={-1} className="min-w-0 px-4 py-8 sm:px-8 lg:ml-64 lg:px-12"><div className="mx-auto max-w-4xl"><MonthlyPlans /></div></main></div>;
}
