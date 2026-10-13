'use client';
import NextLink from 'next/link';
import { useLocale } from 'next-intl';
import { forwardRef, type ComponentProps } from 'react';
import { localizedHref, type Locale } from './locale';

const Link = forwardRef<HTMLAnchorElement, ComponentProps<typeof NextLink>>(function Link({ href, ...props }, ref) {
  const locale = useLocale() as Locale;
  const localized = typeof href === 'string' ? localizedHref(href, locale) : { ...href, pathname: href.pathname ? localizedHref(href.pathname, locale) : href.pathname };
  return <NextLink ref={ref} href={localized} {...props} />;
});
export default Link;
