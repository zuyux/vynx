'use client';

import { useSyncExternalStore } from 'react';
import { createTranslator } from 'next-intl';
import { createCopy } from '@/i18n/copy-core';
import { localizedHref, type Locale } from '@/i18n/locale';
import en from '@/messages/en.json';
import es from '@/messages/es.json';

const subscribe = () => () => {};
const readLocale = (): Locale => /^\/es(?:\/|$)/.test(window.location.pathname) ? 'es' : 'en';

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // Root failures cannot depend on the normal intl provider being mounted.
  const locale = useSyncExternalStore(subscribe, readLocale, () => 'en' as Locale);
  const translate = createTranslator({ locale, messages: (locale === 'es' ? es : en) as { app: Record<string, string> }, namespace: 'app' });
  const t = createCopy((key, values) => values ? translate(key, values) : translate.raw(key), locale);
  return <html lang={locale}><body style={{ margin: 0, background: '#07070a', color: 'white', fontFamily: 'sans-serif' }}>
    <main id="main-content" tabIndex={-1} role="alert" style={{ maxWidth: 480, margin: '15vh auto', padding: 24 }}>
      <h1>{t('We couldn’t open VYNX')}</h1>
      <p>{t('Please try again in a moment.')}</p>
      <button type="button" onClick={retry} style={{ padding: '12px 20px', cursor: 'pointer' }}>{t('Try again')}</button>
      {/* Reload the document when the root layout or router has failed. */}
      <a href={localizedHref('/', locale)} style={{ marginLeft: 20, color: 'white' }}>{t('Go home')}</a>
    </main>
  </body></html>;
}
