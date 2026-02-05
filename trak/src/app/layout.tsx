import type { Metadata } from 'next';
import P2AWarmup from '@/components/ai/p2a-warmup';
// import { Inter, Newsreader, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// Body text - Clean geometric sans
// const inter = Inter({
//   subsets: ['latin'],
//   variable: '--font-sans',
//   display: 'swap',
// });

// Headings - Serif font for "historic studio" feel
// const newsreader = Newsreader({
//   subsets: ['latin'],
//   variable: '--font-serif',
//   display: 'swap',
//   weight: ['400', '500', '600', '700'],
// });

// Code - Monospace
// const jetbrainsMono = JetBrains_Mono({
//   subsets: ['latin'],
//   variable: '--font-mono',
//   display: 'swap',
// });

export const metadata: Metadata = {
  title: 'Trak',
  description: 'Project management made simple',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`bg-[var(--background)] text-[var(--foreground)]`}>
        <div id="app-scale-wrapper">
          {children}
          <P2AWarmup />
        </div>
      </body>
    </html>
  );
}
