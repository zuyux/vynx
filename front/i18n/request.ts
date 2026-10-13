import { headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { isLocale } from './locale';

export default getRequestConfig(async () => {
  const requested = (await headers()).get('x-vynx-locale');
  const locale = isLocale(requested) ? requested : 'en';
  return { locale, messages: (await import(`../messages/${locale}.json`)).default, timeZone: 'America/Lima' };
});
