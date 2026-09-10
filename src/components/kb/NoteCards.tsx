import Link from 'next/link';
import { MonoLabel, STATUS_META, StatusPill } from '@/components/primitives';
import { WikiText } from '@/components/wiki/WikiText';
import type { FreeNote, RumorCard } from '@/lib/queries/kb';
import styles from './NoteCards.module.css';

/* `tab` — открытый раздел списка: карточка уносит его с собой, чтобы ссылка
 * «← К базе знаний» вернула ровно в тот раздел, откуда её открыли. */
export function RumorNote({ card, tab }: { card: RumorCard; tab?: string }) {
  const meta = card.status ? STATUS_META[card.status] : null;

  return (
    <Link
      href={tab && tab !== 'all' ? `/entities/${card.slug}?tab=${tab}` : `/entities/${card.slug}`}
      className={styles.rumor}
      style={
        {
          '--note-color': meta?.color ?? 'var(--rule)',
          '--note-ink': meta?.ink ?? 'var(--ink-body-2)',
          '--note-bg': meta?.background ?? 'var(--card)',
        } as React.CSSProperties
      }
    >
      <span className={meta?.struck ? `${styles.name} ${styles.struck}` : styles.name}>
        {card.name}
      </span>
      {card.status ? <StatusPill status={card.status} links={card.links} /> : null}
      {card.related.length > 0 ? (
        <span className={styles.chips}>
          {card.related.map((node) => (
            <MonoLabel
              key={node.id}
              size={9}
              tracking="0.06em"
              tone="muted"
              className={styles.chip}
            >
              {node.name}
            </MonoLabel>
          ))}
        </span>
      ) : null}
    </Link>
  );
}

export function FreeNoteCard({ note, index }: { note: FreeNote; index: Map<string, string> }) {
  const meta = [
    note.isPrivate ? 'Личная заметка' : 'Заметка',
    note.authorName,
    note.sessionNumber ? `С${note.sessionNumber}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className={styles.note}>
      <MonoLabel size={9} tracking="0.08em" tone={note.isPrivate ? 'accent' : 'label'} block>
        {meta}
      </MonoLabel>
      {note.body ? (
        <p className={styles.noteBody}>
          <WikiText body={note.body} index={index} />
        </p>
      ) : null}
    </article>
  );
}
