export const locales = ['en', 'es'] as const;
export type Locale = (typeof locales)[number];
export const LOCALE_COOKIE = 'VYNX_LOCALE';
export function isLocale(value: unknown): value is Locale { return value === 'en' || value === 'es'; }
export function stripLocale(pathname: string) { return pathname.replace(/^\/(es|en)(?=\/|$)/, '') || '/'; }
export function localizedHref(href: string, locale: Locale) {
  if (!href.startsWith('/') || href.startsWith('//') || /^\/(?:api|_next)(?:\/|$)/.test(href) || /\.[\w]+(?:[?#]|$)/.test(href)) return href;
  const path = href.replace(/^\/(es|en)(?=\/|[?#]|$)/, '') || '/';
  return locale === 'es' ? `/es${path === '/' ? '' : path.startsWith('/') ? path : `/${path}`}` : path.startsWith('/') ? path : `/${path}`;
}
export function preferredLocale(header: string | null, saved?: string): Locale {
  if (isLocale(saved)) return saved;
  const preferences = (header || '').split(',').map((part, index) => {
    const [tag, ...params] = part.trim().split(';');
    const weight = params.find(value => value.trim().startsWith('q='));
    return { language: tag.toLowerCase().split('-')[0], quality: weight ? Number(weight.trim().slice(2)) : 1, index };
  }).filter(item => item.quality > 0).sort((a, b) => b.quality - a.quality || a.index - b.index);
  for (const { language } of preferences) if (isLocale(language)) return language;
  return 'en';
}

export function saveLocalePreference(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
}
