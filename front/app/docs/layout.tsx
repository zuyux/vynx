import { docsLabelKeys } from "@/i18n/docs";

import { useCopy } from "@/i18n/copy";
import type { ReactNode } from 'react';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { BrandLogo } from '@/components/BrandLogo';

export default function Layout({ children }: { children: ReactNode }) {
  const t = useCopy();
  return <div className="dark min-h-screen w-full flex-1 bg-fd-background text-fd-foreground">
    <RootProvider i18n={{ locale: t.locale, defaultLanguage: 'en', hideLocale: 'default-locale', translations: Object.fromEntries(docsLabelKeys.map(key => [key, t(key.split('(')[0])])) }} theme={{ enabled: false }} search={{ enabled: false }}>
      <DocsLayout
        nav={{ title: <span className="heading-font text-xl">{t("VYNX Docs")}</span>, url: t.href('/') }}
        tree={{ name: t('Documentation'), children: [
          { type: 'page', name: t('Getting started'), url: t.href('/docs') },
          { type: 'page', name: t('Fees'), url: t.href('/docs#fees') },
          { type: 'page', name: t('Network'), url: t.href('/docs#network-and-payments') },
          { type: 'page', name: t('Support'), url: t.href('/docs#support') },
        ] }}
        sidebar={{ footer: <BrandLogo /> }}
        themeSwitch={{ enabled: false }}
        searchToggle={{ enabled: false }}
        links={[{ text: t('Brand Kit'), url: t.href('/brand') }]}
      >{children}</DocsLayout>
    </RootProvider>
  </div>;
}
