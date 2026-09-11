'use client';

import { MonoLabel } from '@/components/primitives';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import type { EntryKind } from '@/lib/db/schema';
import styles from './Sidebar.module.css';

/** Кнопка «+…» в шапке блока сайдбара: открывает шит быстрой записи нужным
 *  типом, не уводя с «Хроники». Разлогиненному писать нечем — её нет. */
export function SidebarAdd({ kind, label }: { kind: EntryKind; label: string }) {
  const { canWrite, open } = useQuickEntry();

  if (!canWrite) return null;

  return (
    <button type="button" className={styles.blockAdd} onClick={() => open(kind)}>
      <MonoLabel size={10} tracking="0.08em">
        {label}
      </MonoLabel>
    </button>
  );
}
