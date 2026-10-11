import { SITE_MOTTO } from '@/lib/brand';

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaRegistration } from '@/components/PwaRegistration';
import "./globals.css";
import { LegalLinks } from '@/components/LegalLinks';
import { SITE_TITLE, SITE_DESCRIPTION, siteUrl } from '@/lib/seo';


import { Providers } from "./providers";

import "./stack-sans-notch.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: SITE_TITLE, template: '%s | VYNX' },
  description: SITE_DESCRIPTION,
  applicationName: 'VYNX',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
  openGraph: { type: 'website', siteName: 'VYNX', title: SITE_TITLE, description: SITE_DESCRIPTION, images: [{ url: '/hero-card-asset.png', alt: 'VYNX creator card' }] },
  twitter: { card: 'summary_large_image', title: SITE_TITLE, description: SITE_DESCRIPTION, images: ['/hero-card-asset.png'] },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { 'msvalidate.01': process.env.BING_SITE_VERIFICATION } : undefined,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <meta name="theme-color" content="#0A0A0A" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="VYNX" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body className="min-h-full flex flex-col">
        <PwaRegistration />
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Providers privyAppId={process.env.PRIVY_APP_ID?.trim()}>
          {children}
        </Providers>
        <footer className="border-t border-white/10 bg-[#0A0A0A] px-6 py-6 text-zinc-300"><p className="mb-3 text-center text-sm">{SITE_MOTTO}</p><LegalLinks /></footer>

      </body>
    </html>
  );
}
