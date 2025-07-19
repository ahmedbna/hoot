import { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/providers/theme-provider';
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
    default: 'hoot',
    template: 'hoot | %s',
  },
  description: 'AI CAD, Design Smarter, Faster, Together',
  metadataBase: new URL('https://ahmedbna.com'),
  openGraph: {
    title: 'BNA',
    description: 'BNA AI CAD',
    url: 'https://ahmedbna.com',
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
      url: 'https://www.ahmedbna.com/',
      should_fallback: true,
    },
  },
  verification: {
    google: 'google-site-verification=id',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <head />

      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          enableSystem
          attribute="class"
          defaultTheme="dark"
          storageKey="bna-ai-cad-theme"
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
