'use client';

import { MonoLabel } from '@/components/primitives';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import styles from './NoteCards.module.css';

/** «+ ЗАМЕТКА» — последний элемент списка, открывает быструю запись. */
export function AddNoteButton() {
  const quickEntry = useQuickEntry();
  if (!quickEntry.canWrite) return null;

  return (
    <button type="button" className={styles.add} onClick={() => quickEntry.open()}>
      <MonoLabel size={10} tracking="0.08em">
        + Заметка
      </MonoLabel>
    </button>
  );
}
