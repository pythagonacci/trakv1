import type { Metadata } from 'next';
import P2AWarmup from '@/components/ai/p2a-warmup';
import { Libre_Baskerville } from 'next/font/google';
import './globals.css';

// Libre Baskerville for dashboard headers
const libreBaskerville = Libre_Baskerville({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: 'TWOD',
  description: 'Project management made simple',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={libreBaskerville.variable}>
      <body className={`bg-[var(--background)] text-[var(--foreground)]`}>
        <div id="app-scale-wrapper">
          {children}
          <P2AWarmup />
        </div>
      </body>
    </html>
  );
}
