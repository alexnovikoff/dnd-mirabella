'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/editor/ConfirmDialog';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import type { EditableEntry } from '@/components/editor/QuickEntry';
import { deleteEntry } from '@/lib/actions/entries';
import styles from './EntryActions.module.css';

/** Показывается только автору записи и мастеру — решение принимает сервер,
 *  сюда приходит уже готовый `canEdit`. */
export function EntryActions({ entry, canEdit }: { entry: EditableEntry; canEdit: boolean }) {
  const router = useRouter();
  const { openForEdit } = useQuickEntry();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!canEdit) return null;

  return (
    <div className={styles.row}>
      <button type="button" className={styles.action} onClick={() => openForEdit(entry)}>
        Править
      </button>
      <button type="button" className={styles.action} onClick={() => setConfirming(true)}>
        Удалить
      </button>

      {confirming ? (
        <ConfirmDialog
          title="Удалить запись?"
          body="Вместе с ней исчезнут её связи в графе и голоса. Изображения останутся в галерее."
          quoted={entry.title ?? entry.body ?? entry.caption ?? null}
          confirmLabel="УДАЛИТЬ"
          pending={pending}
          onConfirm={() =>
            startTransition(async () => {
              await deleteEntry(entry.id);
              setConfirming(false);
              router.refresh();
            })
          }
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </div>
  );
}
