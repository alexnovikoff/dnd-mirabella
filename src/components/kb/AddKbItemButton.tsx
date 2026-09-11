'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MonoLabel } from '@/components/primitives';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { createBoardNode } from '@/lib/actions/board';
import { NODE_KIND_TITLE } from '@/lib/nodes';
import type { NodeKind } from '@/lib/db/schema';
import picker from '@/components/editor/Picker.module.css';
import styles from './NoteCards.module.css';

/** Что заводится из базы знаний: свободная заметка либо узел графа.
 *  «Персонаж» здесь — тип узла; карточка персонажа партии с расой, классом
 *  и портретом заводится не здесь. */
export type KbItemType = 'note' | NodeKind;

const NODE_KINDS: NodeKind[] = [
  'character',
  'npc',
  'location',
  'faction',
  'artifact',
  'event',
  'rumor',
  'unknown',
];

/** Первый элемент списка. Раскрывается формой: в базе знаний живут
 *  не только заметки, поэтому тип выбирается до создания, а не правится
 *  потом на странице сущности. */
export function AddKbItemButton({ defaultType = 'note' }: { defaultType?: KbItemType }) {
  const quickEntry = useQuickEntry();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<KbItemType>(defaultType);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!quickEntry.canWrite) return null;

  function close() {
    setOpen(false);
    setName('');
    setError(null);
  }

  if (!open) {
    return (
      <button
        type="button"
        className={styles.add}
        onClick={() => {
          setType(defaultType);
          setOpen(true);
        }}
      >
        <MonoLabel size={10} tracking="0.08em">
          + Добавить
        </MonoLabel>
      </button>
    );
  }

  return (
    <form
      className={styles.addForm}
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);

        /* Текст заметки пишется в шите быстрой записи — здесь только выбор. */
        if (type === 'note') {
          close();
          quickEntry.open('note');
          return;
        }

        startTransition(async () => {
          const result = await createBoardNode(name, type);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          close();
          router.refresh();
        });
      }}
    >
      <div className={styles.addFields}>
        <label className={styles.addField}>
          <MonoLabel size={9} tracking="0.14em" block>
            Тип
          </MonoLabel>
          <select
            className={picker.field}
            value={type}
            autoFocus
            onChange={(e) => setType(e.currentTarget.value as KbItemType)}
          >
            <option value="note">Заметка</option>
            {NODE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {NODE_KIND_TITLE[kind]}
              </option>
            ))}
          </select>
        </label>

        {type !== 'note' ? (
          <label className={styles.addField}>
            <MonoLabel size={9} tracking="0.14em" block>
              Название
            </MonoLabel>
            <input
              className={picker.field}
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="Кузница Стоунфеллоу"
              required
            />
          </label>
        ) : null}
      </div>

      {error ? (
        <MonoLabel size={10} tracking="0.06em" tone="accent" block>
          {error}
        </MonoLabel>
      ) : null}

      <div className={styles.addButtons}>
        <button type="submit" className={styles.addSubmit} disabled={pending}>
          {type === 'note' ? 'НАПИСАТЬ' : 'ДОБАВИТЬ'}
        </button>
        <button type="button" className={styles.addCancel} disabled={pending} onClick={close}>
          ОТМЕНА
        </button>
      </div>
    </form>
  );
}
