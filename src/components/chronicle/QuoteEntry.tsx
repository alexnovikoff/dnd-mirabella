import { AccentQuoteCard } from '@/components/primitives';
import { EntryActions } from '@/components/entry/EntryActions';
import { toEditable } from './MomentCard';
import type { FeedEntry } from '@/lib/queries/chronicle';

/** Цитата в ленте — акцентная карточка. README «Карточка цитаты (акцентная)». */
export function QuoteEntry({ entry, canEdit = false }: { entry: FeedEntry; canEdit?: boolean }) {
  /* Цитата может быть не привязана к сессии — тогда метки просто нет.
   * Шаблонная строка всегда истинна, поэтому проверяем номер до неё. */
  const author = [
    entry.subjectName ?? entry.authorName,
    entry.sessionNumber === null ? null : `сессия ${entry.sessionNumber}`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <AccentQuoteCard quote={entry.body ?? ''} author={`— ${author}`} />
      <EntryActions entry={toEditable(entry)} canEdit={canEdit} />
    </>
  );
}
