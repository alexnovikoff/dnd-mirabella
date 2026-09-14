import Link from 'next/link';
import {
  linksLabel,
  mentionsLabel,
  MonoLabel,
  STATUS_META,
  StatusPill,
} from '@/components/primitives';
import { EditOnClick } from '@/components/entry/EditOnClick';
import { EntryActions } from '@/components/entry/EntryActions';
import { WikiText } from '@/components/wiki/WikiText';
import { NODE_KIND_LABEL } from '@/lib/nodes';
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
      {/* Мета-ряд через «·», как на доске и в макете: тип, статус, связи,
       * упоминания. Статус есть не у каждого узла, а счётчики — у каждого:
       * без статуса они идут следом за типом тем же приглушённым цветом. */}
      <span className={styles.meta}>
        <MonoLabel size={9} tracking="0.08em" tone="muted">
          {card.status
            ? `${NODE_KIND_LABEL[card.kind]} ·`
            : [
                NODE_KIND_LABEL[card.kind],
                linksLabel(card.related.length),
                mentionsLabel(card.mentions),
              ].join(' · ')}
        </MonoLabel>
        {card.status ? (
          <StatusPill status={card.status} links={card.related.length} mentions={card.mentions} />
        ) : null}
      </span>
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

/** «Заметка · Джаду · С14» — мета заметки в базе знаний и в ленте. */
export function noteMeta(note: {
  isPrivate: boolean;
  authorName: string | null;
  sessionNumber: number | null;
}): string {
  return [
    note.isPrivate ? 'Личная заметка' : 'Заметка',
    note.authorName,
    note.sessionNumber ? `С${note.sessionNumber}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function FreeNoteCard({
  note,
  index,
  canEdit = false,
}: {
  note: FreeNote;
  index: Map<string, string>;
  canEdit?: boolean;
}) {
  const entry = {
    id: note.id,
    kind: 'note' as const,
    title: null,
    body: note.body,
    subjectId: note.subjectId,
    sessionId: note.sessionId,
    visibility: note.visibility,
  };

  return (
    <EditOnClick entry={entry} canEdit={canEdit}>
      <article className={canEdit ? `${styles.note} ${styles.noteEditable}` : styles.note}>
        <MonoLabel size={9} tracking="0.08em" tone={note.isPrivate ? 'accent' : 'label'} block>
          {noteMeta(note)}
        </MonoLabel>
        {note.body ? (
          <p className={styles.noteBody}>
            <WikiText body={note.body} index={index} />
          </p>
        ) : null}
        <EntryActions entry={entry} canEdit={canEdit} />
      </article>
    </EditOnClick>
  );
}
