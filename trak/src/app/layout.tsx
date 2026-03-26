import type { Metadata } from 'next';
import P2AWarmup from '@/components/ai/p2a-warmup';
import { Inter, Instrument_Serif } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['300', '400', '500', '600'],
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['400'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Saria',
  description: 'Project management made simple',
  icons: {
    icon: '/LOGO.png',
    apple: '/LOGO.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${instrumentSerif.variable}`}
    >
      <body className={`bg-[var(--background)] text-[var(--foreground)]`}>
        <div id="app-scale-wrapper">
          {children}
          <P2AWarmup />
        </div>
      </body>
    </html>
  );
}
