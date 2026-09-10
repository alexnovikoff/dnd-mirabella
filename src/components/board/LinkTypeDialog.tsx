'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { MonoLabel } from '@/components/primitives';
import { LabelInput } from '@/components/editor/LabelInput';
import { linkNodes, updateLink } from '@/lib/actions/board';
import styles from './LinkTypeDialog.module.css';

/**
 * Окно после дропа узла на узел: связь уже понятна, остаётся сказать, какая
 * она. Тип не обязателен — связь без типа рисуется на доске так же, просто
 * без подписи на линии.
 *
 * Окно своё и по центру, а не поповер у точки дропа: на доске канва
 * масштабируется и прокручивается, и поповер пришлось бы считать в трёх
 * системах координат сразу.
 */
export function LinkTypeDialog({
  from,
  to,
  existingLinkId,
  existingLabel,
  labels,
  onClose,
}: {
  from: { id: string; name: string };
  to: { id: string; name: string };
  /** Ручная связь этой пары уже есть — тогда меняем её тип, а не плодим вторую. */
  existingLinkId: string | null;
  existingLabel: string | null;
  labels: string[];
  onClose: () => void;
}) {
  const sheetRef = useRef<HTMLFormElement>(null);
  const [label, setLabel] = useState(existingLabel ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      className={styles.scrim}
      onMouseDown={(event) => {
        if (!sheetRef.current?.contains(event.target as Node)) onClose();
      }}
    >
      <form
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="Тип связи"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = existingLinkId
              ? await updateLink(existingLinkId, label)
              : await linkNodes(from.id, to.id, label);
            if (result && !result.ok) {
              setError(result.error);
              return;
            }
            onClose();
          });
        }}
      >
        <h2 className={styles.title}>{existingLinkId ? 'Сменить тип связи' : 'Новая связь'}</h2>

        <p className={styles.pair}>
          {from.name}
          <span className={styles.arrow}> → </span>
          {to.name}
        </p>

        <div className={styles.field}>
          <MonoLabel size={9} tracking="0.14em" block>
            Тип связи
          </MonoLabel>
          <LabelInput
            value={label}
            labels={labels}
            placeholder="Долг, вражда, след…"
            ariaLabel="Тип связи"
            autoFocus
            onCommit={setLabel}
          />
          <MonoLabel size={9} tracking="0.06em" tone="faint" block>
            Можно оставить пустым
          </MonoLabel>
        </div>

        {error ? (
          <MonoLabel size={10} tracking="0.06em" tone="accent" block>
            {error}
          </MonoLabel>
        ) : null}

        <div className={styles.buttons}>
          <button type="button" className={styles.button} onClick={onClose} disabled={pending}>
            ОТМЕНА
          </button>
          <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={pending}>
            {pending ? 'СВЯЗЫВАЕМ…' : existingLinkId ? 'СОХРАНИТЬ' : 'СВЯЗАТЬ'}
          </button>
        </div>
      </form>
    </div>
  );
}
