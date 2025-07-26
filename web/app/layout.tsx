import { Geist, Geist_Mono } from 'next/font/google';
import { ConvexAuthNextjsServerProvider } from '@convex-dev/auth/nextjs/server';
import ConvexProvider from '@/providers/convex-provider';
import { Metadata } from 'next';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/providers/theme-provider';
import { Toaster } from 'sonner';
import './globals.css';

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
    default: 'Orca',
    template: 'Orca | %s',
  },
  description: 'Acquire new language',
  metadataBase: new URL('https://hoot.ahmedbna.com'),
  openGraph: {
    title: 'Orca',
    description: 'Orca',
    url: 'https://hoot.ahmedbna.com',
    siteName: 'Orca',
    images: [
      {
        url: '/android-chrome-512x512.png',
        width: 800,
        height: 800,
        alt: 'Orca',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Orca',
    description: 'Orca',
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
      url: 'https://hoot.ahmedbna.com/',
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
              storageKey='bna-ai-orca-theme'
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
