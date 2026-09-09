import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Spectral, IBM_Plex_Mono } from 'next/font/google';
import { Sheet } from '@/components/shell/Sheet';
import { Header } from '@/components/shell/Header';
import { QuickEntryProvider } from '@/components/editor/QuickEntryProvider';
import { getActiveSession, getCampaign } from '@/lib/queries/chronicle';
import { getPickerNodes } from '@/lib/queries/nodes';
import { getViewer } from '@/lib/viewer';
import { shortRuDate } from '@/lib/dates';
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

export async function generateMetadata(): Promise<Metadata> {
  const campaign = await getCampaign();
  return {
    title: campaign?.title ?? 'Кампания',
    description: 'Хроника кампании: яркие моменты, цитаты, галерея, база знаний и доска связей.',
  };
}

export const viewport: Viewport = {
  themeColor: '#ddd0b2',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [campaign, session, nodes, viewer] = await Promise.all([
    getCampaign(),
    getActiveSession(),
    getPickerNodes(),
    getViewer(),
  ]);
  const title = campaign?.title ?? 'Кампания';
  const sessionLabel = session ? `Сессия ${session.number} · ${shortRuDate(session.date)}` : '';
  const sessionShort = session ? `С${session.number}` : '';
  const characters = nodes.filter((node) => node.kind === 'character');

  return (
    <html lang="ru" className={`${cormorant.variable} ${spectral.variable} ${plexMono.variable}`}>
      <body>
        <QuickEntryProvider
          nodes={nodes}
          characters={characters}
          sessionShort={sessionShort}
          canWrite={viewer !== null}
          isDm={viewer?.role === 'dm'}
        >
          <Sheet>
            <Header
              campaignTitle={title}
              seal={campaign?.seal ?? '?'}
              sessionLabel={sessionLabel}
              viewer={viewer}
            />
            {children}
          </Sheet>
        </QuickEntryProvider>
      </body>
    </html>
  );
}
