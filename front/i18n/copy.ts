import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { createCopy } from './copy-core';
import type { Locale } from './locale';

export function useCopy() {
  const t = useTranslations('app');
  const locale = useLocale() as Locale;
  return useMemo(() => createCopy((key, values) => values ? t(key, values) : t.raw(key), locale), [t, locale]);
}
