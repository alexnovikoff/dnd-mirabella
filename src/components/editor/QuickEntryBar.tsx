'use client';

import { MonoLabel } from '@/components/primitives';
import { useQuickEntry } from './QuickEntryProvider';
import styles from './QuickEntryBar.module.css';

/** Нижняя закреплённая полоса мобильного экрана. */
export function QuickEntryBar() {
  const quickEntry = useQuickEntry();

  return (
    <div className={styles.bar}>
      <MonoLabel size={10} tracking="0.08em" tone="faint">
        {quickEntry.sessionShort}
      </MonoLabel>
      <button type="button" className={styles.button} onClick={quickEntry.open}>
        + БЫСТРАЯ ЗАПИСЬ
      </button>
    </div>
  );
}
