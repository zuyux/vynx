import { getLocale } from "next-intl/server";
import { localizedHref, type Locale } from "@/i18n/locale";

import { getCopy } from "@/i18n/server";
import { WalletAuthGate } from '@/components/WalletAuthGate';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { safeDestination } from '@/lib/alias';
import { appDb } from '@/lib/app-db';
import { readSession, SESSION_COOKIE } from '@/lib/wallet-session';
import { PRIVATE_METADATA } from '@/lib/seo';

export const metadata = PRIVATE_METADATA;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = await getCopy();
  const wallet = await readSession((await cookies()).get(SESSION_COOKIE)?.value ?? '');
  const destination = safeDestination((await headers()).get('x-vynx-destination'));
  if (!wallet) return <WalletAuthGate />;
  const { data, error } = await appDb().from('cards_users').select('username').eq('wallet_address', wallet).maybeSingle();
  if (error) throw new Error(t('Unable to load your creator profile.'));
  if (!data) redirect(localizedHref(`/profile/buy-alias?next=${encodeURIComponent(destination)}`, await getLocale() as Locale));
  return children;
}
