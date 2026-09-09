'use client';

import { useEffect, useRef } from 'react';
import { MonoLabel } from '@/components/primitives';
import styles from './ConfirmDialog.module.css';

export function ConfirmDialog({
  title,
  body,
  quoted,
  confirmLabel,
  cancelLabel = 'ОТМЕНА',
  pending = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  /** Что именно удаляем — чтобы не удалить не то. */
  quoted?: string | null;
  confirmLabel: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  return (
    <div
      className={styles.scrim}
      onMouseDown={(event) => {
        if (!sheetRef.current?.contains(event.target as Node)) onCancel();
      }}
    >
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.body}>{body}</p>
        {quoted ? <p className={styles.quoted}>{quoted}</p> : null}

        <div className={styles.buttons}>
          <button type="button" className={styles.button} onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.danger}`}
            onClick={onConfirm}
            disabled={pending}
            autoFocus
          >
            {pending ? 'УДАЛЯЕМ…' : confirmLabel}
          </button>
        </div>

        <MonoLabel size={9} tracking="0.06em" tone="faint" block>
          Отменить удаление нельзя
        </MonoLabel>
      </div>
    </div>
  );
}
