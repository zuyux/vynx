import type { Metadata } from 'next';
import { getCopy } from './server';
import { localizedHref } from './locale';

export async function localizeMetadata(metadata: Metadata, pathname: string): Promise<Metadata> {
  const t = await getCopy();
  const description = metadata.description ? t(metadata.description) : undefined;
  return { ...metadata,
    ...(typeof metadata.title === 'string' ? { title: t(metadata.title) } : {}),
    ...(description ? { description } : {}),
    alternates: { ...metadata.alternates, canonical: localizedHref(pathname, t.locale), languages: { en: pathname, es: localizedHref(pathname, 'es'), 'x-default': pathname } },
    ...(metadata.openGraph ? { openGraph: { ...metadata.openGraph, url: localizedHref(pathname, t.locale), locale: t.locale === 'es' ? 'es_ES' : 'en_US', alternateLocale: t.locale === 'es' ? ['en_US'] : ['es_ES'], ...(typeof metadata.openGraph.title === 'string' ? { title: t(metadata.openGraph.title) } : {}), ...(metadata.openGraph.description ? { description: t(metadata.openGraph.description) } : {}) } } : {}),
  };
}
