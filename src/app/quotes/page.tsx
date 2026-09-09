import { Screen } from '@/components/shell/Screen';
import {
  AccentQuoteCard,
  FilterChips,
  MonoLabel,
  ParchmentCard,
  QuoteBody,
} from '@/components/primitives';
import { VoteButton } from '@/components/quotes/VoteButton';
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

  return (
    <Screen
      title="Цитатник"
      note={`${data.total} ${plural(data.total, 'цитата', 'цитаты', 'цитат')} за ${data.sessions} ${plural(data.sessions, 'сессию', 'сессии', 'сессий')}. Цитата недели — та, что набрала больше голосов за последние семь дней.`}
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
        {data.ofWeek && !author ? (
          <AccentQuoteCard
            className={styles.wide}
            variant="feature"
            eyebrow={`Цитата недели${data.ofWeek.sessionNumber ? ` · сессия ${data.ofWeek.sessionNumber}` : ''}`}
            quote={data.ofWeek.body ?? ''}
            author={data.ofWeek.authorName ? `— ${data.ofWeek.authorName}` : undefined}
            meta={
              <VoteButton
                entryId={data.ofWeek.id}
                votes={data.ofWeek.votes}
                mine={data.ofWeek.myVote}
                withNoun
              />
            }
          />
        ) : null}

        {data.quotes.map((quote) => (
          <ParchmentCard key={quote.id} as="article" padding="tight" className={styles.card}>
            <blockquote className={styles.quote}>
              <QuoteBody text={quote.body ?? ''} />
            </blockquote>
            <div className={styles.footer}>
              <MonoLabel size={9} tracking="0.08em" tone="faint">
                {[quote.authorName, quote.sessionNumber ? `С${quote.sessionNumber}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </MonoLabel>
              <VoteButton entryId={quote.id} votes={quote.votes} mine={quote.myVote} />
            </div>
          </ParchmentCard>
        ))}

        {/* README: импорт из Discord или расшифровки — фича на потом. */}
        <div className={styles.placeholder}>
          <MonoLabel size={11} tracking="0.08em" tone="faint">
            Вставить цитату из чата или голоса
          </MonoLabel>
        </div>
      </div>
    </Screen>
  );
}
