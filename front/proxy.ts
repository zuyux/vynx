import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE, preferredLocale, stripLocale, localizedHref } from './i18n/locale';

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const prefix = /^\/(es|en)(?=\/|$)/.exec(pathname)?.[1];
  const locale = prefix === 'es' ? 'es' : prefix === 'en' ? 'en' : preferredLocale(request.headers.get('accept-language'), request.cookies.get(LOCALE_COOKIE)?.value);
  if ((!prefix && locale === 'es') || prefix === 'en') {
    const url = request.nextUrl.clone();
    url.pathname = localizedHref(stripLocale(pathname), locale);
    const response = NextResponse.redirect(url);
    if (prefix) response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 31536000, sameSite: 'lax' });
    return response;
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-vynx-locale', locale);
  requestHeaders.set('x-vynx-destination', stripLocale(pathname) + request.nextUrl.search);
  const url = request.nextUrl.clone();
  url.pathname = stripLocale(pathname);
  const response = prefix ? NextResponse.rewrite(url, { request: { headers: requestHeaders } }) : NextResponse.next({ request: { headers: requestHeaders } });
  // Link prefetches must never overwrite the choice saved by the footer.
  return response;
}

export const config = { matcher: ['/((?!api(?:/|$)|_next(?:/|$)|.*\\..*).*)'] };
