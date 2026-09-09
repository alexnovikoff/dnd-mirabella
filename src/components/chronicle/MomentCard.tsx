import { Fragment } from 'react';
import { ImagePlaceholder, MonoLabel, ParchmentCard } from '@/components/primitives';
import { WikiText } from '@/components/wiki/WikiText';
import { EntryActions } from '@/components/entry/EntryActions';
import type { FeedEntry } from '@/lib/queries/chronicle';
import styles from './MomentCard.module.css';

/** Строка меты: «СЕССИЯ 26 · ТА САМАЯ ТАВЕРНА · КРИТ 20».
 *  Разделители — цветом линии, критический успех и провал — акцентом. */
function Meta({ entry }: { entry: FeedEntry }) {
  const parts: { text: string; accent?: boolean }[] = [];
  if (entry.sessionNumber !== null) parts.push({ text: `Сессия ${entry.sessionNumber}` });
  if (entry.sessionTitle) parts.push({ text: entry.sessionTitle });
  if (entry.isCrit) parts.push({ text: `Крит ${entry.roll ?? 20}`, accent: true });
  if (entry.isFail) parts.push({ text: `Провал ${entry.roll ?? 1}`, accent: true });

  return (
    <div className={styles.meta}>
      <MonoLabel size={10} tracking="0.06em" tone="faint">
        {parts.map((part, i) => (
          <Fragment key={i}>
            {i > 0 ? <span className={styles.sep}> · </span> : null}
            <span style={part.accent ? { color: 'var(--accent)' } : undefined}>{part.text}</span>
          </Fragment>
        ))}
      </MonoLabel>
    </div>
  );
}

export function MomentCard({
  entry,
  index,
  canEdit = false,
}: {
  entry: FeedEntry;
  index: Map<string, string>;
  canEdit?: boolean;
}) {
  return (
    <ParchmentCard as="article" interactive>
      <Meta entry={entry} />
      {entry.title ? <h3 className={styles.title}>{entry.title}</h3> : null}
      {entry.body ? (
        <p className={styles.body}>
          <WikiText body={entry.body} index={index} />
        </p>
      ) : null}
      {entry.image ? (
        <ImagePlaceholder caption={entry.image.caption ?? undefined} height={150} />
      ) : null}
      {entry.tags.length > 0 ? (
        <div className={styles.tags}>
          {entry.tags.map((tag) => (
            <MonoLabel key={tag} size={10} tracking="0.06em" tone="muted" className={styles.tag}>
              {tag}
            </MonoLabel>
          ))}
        </div>
      ) : null}
      <EntryActions entry={toEditable(entry)} canEdit={canEdit} />
    </ParchmentCard>
  );
}

/** Поля для шита правки — они уже есть в карточке, лишний запрос не нужен. */
export function toEditable(entry: FeedEntry) {
  return {
    id: entry.id,
    kind: entry.kind,
    title: entry.title,
    body: entry.body,
    subjectId: entry.subjectId,
    visibility: entry.visibility,
  };
}

/** Компактная карточка для записей постарше — README «Компактная карточка». */
export function CompactMomentCard({
  entry,
  index,
  canEdit = false,
}: {
  entry: FeedEntry;
  index: Map<string, string>;
  canEdit?: boolean;
}) {
  return (
    <ParchmentCard as="article" padding="tight" interactive className={styles.compact}>
      <ImagePlaceholder
        caption={entry.image?.caption ?? undefined}
        align="bottom"
        hatchStep={6}
        height={84}
        className={styles.compactPreview}
      />
      <div className={styles.compactText}>
        <Meta entry={entry} />
        {entry.title ? <h3 className={styles.compactTitle}>{entry.title}</h3> : null}
        {entry.body ? (
          <p className={styles.compactBody}>
            <WikiText body={entry.body} index={index} />
          </p>
        ) : null}
        <EntryActions entry={toEditable(entry)} canEdit={canEdit} />
      </div>
    </ParchmentCard>
  );
}
