'use client';

import { MonoLabel } from '@/components/primitives';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import styles from './Quotes.module.css';

/** Последняя ячейка сетки: заводит цитату тем же шитом, что и кнопка в шапке. */
export function NewQuoteButton() {
  const { canWrite, open } = useQuickEntry();

  /* Разлогиненному кнопка бесполезна: шит для него всё равно не откроется. */
  if (!canWrite) return null;

  return (
    <button type="button" className={styles.add} onClick={() => open('quote')}>
      <MonoLabel size={10} tracking="0.08em">
        Новая цитата
      </MonoLabel>
    </button>
  );
}
