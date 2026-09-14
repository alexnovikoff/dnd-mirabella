'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { MonoLabel } from '@/components/primitives';
import { LabelInput } from '@/components/editor/LabelInput';
import { deleteLink, linkNodes, updateLink } from '@/lib/actions/board';
import { REMOVE_LINK_BODY } from './RemoveLinkButton';
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
  /* Подтверждение удаления — шагом этого же окна, а не ConfirmDialog поверх:
   * оба окна ловят Escape на document, и закрылись бы разом. */
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        /* Из подтверждения Escape возвращает к типу, как «ОТМЕНА». */
        if (removing) setRemoving(false);
        else onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose, removing]);

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
        role={removing ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-label={removing ? 'Убрать связь?' : 'Тип связи'}
        onSubmit={(event) => {
          event.preventDefault();
          if (removing) return;
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
        {removing && existingLinkId ? (
          <>
            <h2 className={styles.title}>Убрать связь?</h2>
            <p className={styles.body}>{REMOVE_LINK_BODY}</p>
            <p className={styles.pair}>
              {from.name}
              <span className={styles.arrow}> → </span>
              {to.name}
              {existingLabel ? ` · ${existingLabel}` : null}
            </p>

            <div className={styles.buttons}>
              <button
                type="button"
                className={styles.button}
                onClick={() => setRemoving(false)}
                disabled={pending}
              >
                ОТМЕНА
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.primary}`}
                disabled={pending}
                autoFocus
                onClick={() =>
                  startTransition(async () => {
                    await deleteLink(existingLinkId);
                    onClose();
                  })
                }
              >
                {pending ? 'УДАЛЯЕМ…' : 'УБРАТЬ'}
              </button>
            </div>

            <MonoLabel size={9} tracking="0.06em" tone="faint" block>
              Отменить удаление нельзя
            </MonoLabel>
          </>
        ) : (
          <>
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
              <button
                type="submit"
                className={`${styles.button} ${styles.primary}`}
                disabled={pending}
              >
                {pending ? 'СВЯЗЫВАЕМ…' : existingLinkId ? 'СОХРАНИТЬ' : 'СВЯЗАТЬ'}
              </button>
            </div>

            {/* Связь этой пары уже есть — здесь же её и убирают: не искать
                потом крестик в панели узла. */}
            {existingLinkId ? (
              <button
                type="button"
                className={styles.remove}
                onClick={() => setRemoving(true)}
                disabled={pending}
              >
                УБРАТЬ СВЯЗЬ
              </button>
            ) : null}
          </>
        )}
      </form>
    </div>
  );
}
