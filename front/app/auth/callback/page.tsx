import { getLocale } from "next-intl/server";
import { localizedHref, type Locale } from "@/i18n/locale";
import { redirect } from 'next/navigation';
import { safeDestination } from '@/lib/alias';

// Provider callbacks resume on the requested page; wallet sign-in stays inline.
export default async function AuthCallback({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  redirect(localizedHref(safeDestination(params.next ?? null), await getLocale() as Locale));
}
