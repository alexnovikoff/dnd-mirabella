'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MonoLabel } from '@/components/primitives';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { createSession } from '@/lib/actions/sessions';
import styles from './Session.module.css';

/** Новая сессия сразу становится активной: к ней цепляются новые записи. */
export function NewSessionButton() {
  const router = useRouter();
  const { canWrite } = useQuickEntry();
  const [pending, startTransition] = useTransition();

  if (!canWrite) return null;

  return (
    <button
      type="button"
      className={styles.action}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await createSession();
          if (result.ok) {
            router.push(`/sessions/${result.number}`);
            router.refresh();
          }
        })
      }
    >
      <MonoLabel size={10} tracking="0.08em">
        + Сессия
      </MonoLabel>
    </button>
  );
}
