import { getLocale, getTranslations } from 'next-intl/server';
import { createCopy } from './copy-core';
import type { Locale } from './locale';
export { useCopy } from './copy';
export async function getCopy() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations('app')]);
  return createCopy((key, values) => values ? t(key, values) : t.raw(key), locale as Locale);
}
