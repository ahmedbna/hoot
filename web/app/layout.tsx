import { Geist, Geist_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import { ConvexAuthNextjsServerProvider } from '@convex-dev/auth/nextjs/server';
import { ApplyThemeScript, ThemeToggle } from '@/components/theme-toggle';
import { getAppConfig } from '@/lib/utils';
import ConvexProvider from '@/providers/convex-provider';
import './globals.css';

import './globals.css';
import { Metadata } from 'next';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/providers/theme-provider';
import { Toaster } from 'sonner';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'BNA AI CAD',
    template: 'BNA | %s',
  },
  description: 'AI CAD, Design Smarter, Faster, Together',
  metadataBase: new URL('https://cad.ahmedbna.com'),
  openGraph: {
    title: 'BNA',
    description: 'BNA AI CAD',
    url: 'https://cad.ahmedbna.com',
    siteName: 'BNA',
    images: [
      {
        url: '/android-chrome-512x512.png',
        width: 800,
        height: 800,
        alt: 'BNA',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BNA',
    description: 'BNA AI CAD',
    images: ['/android-chrome-512x512.png'],
  },
  icons: {
    icon: '/apple-touch-icon.png',
    shortcut: '/apple-touch-icon.png',
    apple: '/apple-touch-icon.png',
    other: {
      rel: 'apple-touch-icon-precomposed',
      url: '/apple-touch-icon.png',
    },
  },
  appLinks: {
    web: {
      url: 'https://cad.ahmedbna.com/',
      should_fallback: true,
    },
  },
  verification: {
    google: 'google-site-verification=id',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hdrs = await headers();
  const { accent, accentDark, pageTitle, pageDescription } =
    await getAppConfig(hdrs);

  const styles = [
    accent ? `:root { --primary: ${accent}; }` : '',
    accentDark ? `.dark { --primary: ${accentDark}; }` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <ConvexAuthNextjsServerProvider>
      <html lang='en' suppressHydrationWarning>
        <head />

        <ConvexProvider>
          <body
            className={`${geistSans.variable} ${geistMono.variable} antialiased`}
          >
            <ThemeProvider
              enableSystem
              attribute='class'
              defaultTheme='dark'
              storageKey='bna-ai-cad-theme'
              disableTransitionOnChange
            >
              <TooltipProvider>{children}</TooltipProvider>
              <Toaster />
            </ThemeProvider>
          </body>
        </ConvexProvider>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
