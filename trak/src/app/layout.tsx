import type { Metadata } from 'next';
import P2AWarmup from '@/components/ai/p2a-warmup';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
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
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className={`bg-[var(--background)] text-[var(--foreground)]`}>
        <div id="app-scale-wrapper">
          {children}
          <P2AWarmup />
        </div>
      </body>
    </html>
  );
}
