import { AccentQuoteCard } from '@/components/primitives';
import { plural } from '@/lib/plural';
import type { FeedEntry } from '@/lib/queries/chronicle';

/** Цитата в ленте — акцентная карточка. README «Карточка цитаты (акцентная)». */
export function QuoteEntry({ entry }: { entry: FeedEntry }) {
  const author = [entry.subjectName ?? entry.authorName, `сессия ${entry.sessionNumber}`]
    .filter(Boolean)
    .join(', ');

  return (
    <AccentQuoteCard
      quote={entry.body ?? ''}
      author={`— ${author}`}
      meta={
        entry.votes > 0
          ? `♦ ${entry.votes} ${plural(entry.votes, 'голос', 'голоса', 'голосов')}`
          : undefined
      }
    />
  );
}
