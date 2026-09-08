import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Spectral, IBM_Plex_Mono } from 'next/font/google';
import { Sheet } from '@/components/shell/Sheet';
import { Header } from '@/components/shell/Header';
import { CAMPAIGN } from '@/lib/campaign';
import '@/styles/globals.css';

/* Шрифты самохостятся Next'ом: внешнего запроса к fonts.googleapis.com нет,
 * подстановки шрифта при загрузке — тоже. Кириллица есть у всех трёх. */

const cormorant = Cormorant_Garamond({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

const spectral = Spectral({
  subsets: ['cyrillic', 'latin'],
  weight: ['300', '400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-spectral',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: CAMPAIGN.title,
  description: 'Хроника кампании: яркие моменты, цитаты, галерея, база знаний и доска связей.',
};

export const viewport: Viewport = {
  themeColor: '#ddd0b2',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${cormorant.variable} ${spectral.variable} ${plexMono.variable}`}>
      <body>
        <Sheet>
          <Header />
          {children}
        </Sheet>
      </body>
    </html>
  );
}
