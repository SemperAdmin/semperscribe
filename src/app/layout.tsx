import type {Metadata} from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { DisclaimerModal } from "@/components/DisclaimerModal";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

// The UI fonts ship with the app (src/app/fonts, SIL OFL 1.1, from
// Fontsource 5.3.0) rather than being fetched from Google Fonts at build
// time: a bad response from Google failed the cloud.gov build of an
// unchanged commit, and the build should not depend on a third party.
const bebasNeue = localFont({
  src: './fonts/bebas-neue-latin-400-normal.woff2',
  weight: '400',
  variable: '--font-bebas-neue',
  display: 'swap',
});

const roboto = localFont({
  src: [
    { path: './fonts/roboto-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/roboto-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/roboto-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-roboto',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Semper Scribe',
  description: 'Formats USMC correspondence, directives, and forms to SECNAV M-5216.5 in the browser. Local-first, works offline.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${bebasNeue.variable} ${roboto.variable}`}>
      <head>
        {/* Reloads once when a chunk from a previous deploy is gone. A plain
            synchronous <script> in <head> runs before the app hydrates;
            next/script beforeInteractive in the App Router queues the file
            behind the Next runtime instead, which is too late. basePath is the
            value next.config.ts computes. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/chunk-reload-guard.js`} />
      </head>
      <body className="font-body antialiased flex flex-col min-h-screen">
        <ThemeProvider>
          <main className="flex-1">
            {children}
          </main>
          <DisclaimerModal />
          <Toaster />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
