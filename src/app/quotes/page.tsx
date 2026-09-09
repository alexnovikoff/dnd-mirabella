import { Screen } from '@/components/shell/Screen';
import { FilterChips, MonoLabel, ParchmentCard, QuoteBody } from '@/components/primitives';
import { EntryActions } from '@/components/entry/EntryActions';
import { NewQuoteButton } from '@/components/quotes/NewQuoteButton';
import { getQuoteAuthors, getQuotes } from '@/lib/queries/quotes';
import { getViewer } from '@/lib/viewer';
import { plural } from '@/lib/plural';
import styles from '@/components/quotes/Quotes.module.css';

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ author?: string }>;
}) {
  const { author } = await searchParams;
  const viewer = await getViewer();

  const [authors, data] = await Promise.all([getQuoteAuthors(), getQuotes(author ?? null, viewer)]);

  /* Правит свою цитату её автор; мастер — любую. Проверку повторяет сервер. */
  const canEdit = (authorId: string | null) =>
    viewer !== null && (viewer.role === 'dm' || authorId === viewer.id);

  return (
    <Screen
      title="Цитатник"
      note={`${data.total} ${plural(data.total, 'цитата', 'цитаты', 'цитат')} за ${data.sessions} ${plural(data.sessions, 'сессию', 'сессии', 'сессий')}.`}
      aside={
        <FilterChips
          activeId={author ?? 'all'}
          ariaLabel="Фильтр по автору"
          items={[
            { id: 'all', label: 'ВСЕ', href: '/quotes' },
            ...authors.map((item) => ({
              id: item.slug,
              label: item.name.toUpperCase(),
              href: `/quotes?author=${item.slug}`,
            })),
          ]}
        />
      }
    >
      <div className={styles.grid}>
        {data.quotes.map((quote) => (
          <ParchmentCard key={quote.id} as="article" padding="tight" className={styles.card}>
            <blockquote className={styles.quote}>
              <QuoteBody text={quote.body ?? ''} />
            </blockquote>
            <div className={styles.footer}>
              <MonoLabel size={10} tracking="0.08em" tone="faint">
                {[quote.authorName, quote.sessionNumber ? `С${quote.sessionNumber}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </MonoLabel>
              <EntryActions
                entry={{
                  id: quote.id,
                  kind: 'quote',
                  title: null,
                  body: quote.body,
                  subjectId: quote.subjectId,
                  sessionId: quote.sessionId,
                  visibility: quote.visibility,
                }}
                canEdit={canEdit(quote.authorId)}
              />
            </div>
          </ParchmentCard>
        ))}

        <NewQuoteButton />
      </div>
    </Screen>
  );
}
