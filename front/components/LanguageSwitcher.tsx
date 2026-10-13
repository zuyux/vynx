'use client';
import { useLocale } from 'next-intl';
import { saveLocalePreference, localizedHref, type Locale } from '@/i18n/locale';

export function LanguageSwitcher() {
  const locale = useLocale();
  function changeLanguage(next: Locale) {
    saveLocalePreference(next);
    window.location.assign(localizedHref(location.pathname + location.search + location.hash, next));
  }
  return <nav aria-label={locale === 'es' ? 'Idioma' : 'Language'} className="mt-4 flex justify-center gap-2 text-sm">
    {(['es', 'en'] as const).map(language => <button key={language} type="button" lang={language} aria-label={language === 'es' ? 'Español' : 'English'} aria-pressed={locale === language} onClick={() => changeLanguage(language)} className={`min-h-11 min-w-11 rounded-md px-3 py-2 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-300 ${locale === language ? 'font-semibold text-white underline underline-offset-4' : 'text-zinc-400'}`}>{language.toUpperCase()}</button>)}
  </nav>;
}
