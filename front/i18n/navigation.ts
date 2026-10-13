'use client';
import { useRouter as useNextRouter, usePathname as useNextPathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useMemo } from 'react';
import { localizedHref, stripLocale, type Locale } from './locale';
export function usePathname() { return stripLocale(useNextPathname()); }
export function useRouter() {
  const router = useNextRouter();
  const locale = useLocale() as Locale;
  return useMemo(() => ({ ...router,
    push: (href: string, options?: Parameters<typeof router.push>[1]) => router.push(localizedHref(href, locale), options),
    replace: (href: string, options?: Parameters<typeof router.replace>[1]) => router.replace(localizedHref(href, locale), options),
    prefetch: (href: string, options?: Parameters<typeof router.prefetch>[1]) => router.prefetch(localizedHref(href, locale), options),
  }), [router, locale]);
}
