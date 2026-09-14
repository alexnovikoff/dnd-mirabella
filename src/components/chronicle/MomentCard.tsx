import { Fragment } from 'react';
import Image from 'next/image';
import { MonoLabel, ParchmentCard } from '@/components/primitives';
import { WikiText } from '@/components/wiki/WikiText';
import { EntryActions } from '@/components/entry/EntryActions';
import type { FeedEntry, FeedThumbnail } from '@/lib/queries/chronicle';
import styles from './MomentCard.module.css';

/** Строка меты: «СЕССИЯ 26 · ТА САМАЯ ТАВЕРНА». Разделители — цветом линии. */
function Meta({ entry }: { entry: FeedEntry }) {
  const parts: string[] = [];
  if (entry.sessionNumber !== null) parts.push(`Сессия ${entry.sessionNumber}`);
  if (entry.sessionTitle) parts.push(entry.sessionTitle);

  return (
    <div className={styles.meta}>
      <MonoLabel size={10} tracking="0.06em" tone="faint">
        {parts.map((part, i) => (
          <Fragment key={i}>
            {i > 0 ? <span className={styles.sep}> · </span> : null}
            <span>{part}</span>
          </Fragment>
        ))}
      </MonoLabel>
    </div>
  );
}

/** Кадр записи или упомянутого узла (выбор — в getFeed). Карточка без кадра
 *  обходится без блока: пустая штриховка на его месте ничего не показывает. */
function Thumbnail({
  thumbnail,
  className,
  sizes,
}: {
  thumbnail: FeedThumbnail;
  className: string;
  sizes: string;
}) {
  return (
    <div className={className}>
      <Image src={thumbnail.url} alt={thumbnail.alt} fill sizes={sizes} className={styles.photo} />
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
      {entry.thumbnail ? (
        <Thumbnail thumbnail={entry.thumbnail} className={styles.thumb} sizes="200px" />
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
    sessionId: entry.sessionId,
    visibility: entry.visibility,
    /* Подпись кадра — единственное, что правится у записи-фото. Без неё шит
     * открывался бы с пустым полем и стирал подпись при сохранении. */
    caption: entry.image?.caption ?? null,
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
      {entry.thumbnail ? (
        <Thumbnail
          thumbnail={entry.thumbnail}
          className={styles.compactPreview}
          sizes="(max-width: 767px) 100vw, 108px"
        />
      ) : null}
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
