'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MonoLabel } from '@/components/primitives';
import { ConfirmDialog } from '@/components/editor/ConfirmDialog';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { addPersonalNote, deletePersonalNote } from '@/lib/actions/characters';
import picker from '@/components/editor/Picker.module.css';
import styles from './Character.module.css';

export type PersonalNote = { id: string; body: string | null };

/** Личные заметки о персонаже. Их видит только автор и мастер — отбор идёт
 *  в запросе, сюда приходит уже отфильтрованный список. */
export function PersonalNotes({ nodeId, notes }: { nodeId: string; notes: PersonalNote[] }) {
  const router = useRouter();
  const { canWrite } = useQuickEntry();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [removing, setRemoving] = useState<PersonalNote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (notes.length === 0 && !canWrite) return null;

  return (
    <div className={styles.block}>
      <MonoLabel size={10} tracking="0.14em" block>
        Личные заметки
      </MonoLabel>

      {notes.map((note) => (
        <div key={note.id} className={styles.privateNote}>
          <div className={styles.noteRow}>
            <span style={{ flex: 1 }}>{note.body}</span>
            {canWrite ? (
              <button
                type="button"
                className={styles.noteRemove}
                title="Удалить заметку"
                aria-label="Удалить заметку"
                onClick={() => setRemoving(note)}
              >
                ×
              </button>
            ) : null}
          </div>
          <MonoLabel size={9} tracking="0.06em" block>
            Видно только игроку
          </MonoLabel>
        </div>
      ))}

      {canWrite ? (
        adding ? (
          <>
            <textarea
              className={`${picker.field} ${styles.noteTextarea}`}
              value={draft}
              autoFocus
              placeholder="Что стоит помнить и не рассказывать"
              onChange={(e) => setDraft(e.currentTarget.value)}
            />
            {error ? (
              <MonoLabel size={9} tracking="0.06em" tone="accent" block>
                {error}
              </MonoLabel>
            ) : null}
            <div className={styles.formButtons}>
              <button
                type="button"
                className={styles.submit}
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await addPersonalNote(nodeId, draft);
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    setDraft('');
                    setAdding(false);
                    setError(null);
                    router.refresh();
                  })
                }
              >
                СОХРАНИТЬ
              </button>
              <button
                type="button"
                className={styles.cancel}
                onClick={() => {
                  setAdding(false);
                  setDraft('');
                  setError(null);
                }}
              >
                ОТМЕНА
              </button>
            </div>
          </>
        ) : (
          <button type="button" className={styles.smallAction} onClick={() => setAdding(true)}>
            + Заметка
          </button>
        )
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Удалить заметку?"
          body="Заметку видели только вы и мастер. Восстановить её будет нельзя."
          quoted={removing.body}
          confirmLabel="УДАЛИТЬ"
          pending={pending}
          onConfirm={() =>
            startTransition(async () => {
              await deletePersonalNote(removing.id);
              setRemoving(null);
              router.refresh();
            })
          }
          onCancel={() => setRemoving(null)}
        />
      ) : null}
    </div>
  );
}
