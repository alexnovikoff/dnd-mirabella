import { MonoLabel, ParchmentCard } from '@/components/primitives';
import { WikiText } from '@/components/wiki/WikiText';
import { EditOnClick } from '@/components/entry/EditOnClick';
import { EntryActions } from '@/components/entry/EntryActions';
import { noteMeta } from '@/components/kb/NoteCards';
import { toEditable } from './MomentCard';
import type { FeedEntry } from '@/lib/queries/chronicle';
import styles from './MomentCard.module.css';

/** Заметка в ленте — пергамент с метой «Заметка · автор · сессия», как на
 *  карточке сессии. Компактного варианта нет: превью кадра заметке не нужно. */
export function NoteEntry({
  entry,
  index,
  canEdit = false,
}: {
  entry: FeedEntry;
  index: Map<string, string>;
  canEdit?: boolean;
}) {
  const isPrivate = entry.visibility === 'private';
  const editable = toEditable(entry);

  return (
    <EditOnClick entry={editable} canEdit={canEdit}>
      <ParchmentCard as="article" padding="tight" interactive={canEdit}>
        <MonoLabel size={9} tracking="0.08em" tone={isPrivate ? 'accent' : 'label'} block>
          {noteMeta({ ...entry, isPrivate })}
        </MonoLabel>
        {entry.body ? (
          <p className={styles.compactBody}>
            <WikiText body={entry.body} index={index} />
          </p>
        ) : null}
        <EntryActions entry={editable} canEdit={canEdit} />
      </ParchmentCard>
    </EditOnClick>
  );
}
