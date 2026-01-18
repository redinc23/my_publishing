import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';

// Use system font stack as fallback when Google Fonts is unavailable
const fontClassName = 'font-sans';

export const metadata: Metadata = {
  title: 'MANGU - Digital Publishing Platform',
  description: 'Discover, read, and publish books on the MANGU platform',
  themeColor: '#0a0a0a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={fontClassName} suppressHydrationWarning>
      <body>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
