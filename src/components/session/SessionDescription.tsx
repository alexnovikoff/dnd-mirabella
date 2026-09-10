'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MonoLabel } from '@/components/primitives';
import { ConfirmDialog } from '@/components/editor/ConfirmDialog';
import { WikiTextarea } from '@/components/editor/WikiTextarea';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { createDraftNode } from '@/lib/actions/entries';
import { deleteSessionDescription, saveSessionDescription } from '@/lib/actions/sessions';
import type { PickerNode } from '@/lib/queries/nodes';
import styles from './Session.module.css';

/**
 * Пересказ игры своими словами: что за вечер вообще произошёл.
 *
 * Заводит, правит и стирает его любой вошедший — и игрок, и мастер: сессия
 * за столом общая. Текст с [[ссылками]] рисует сервер и передаёт готовым в
 * `children` — клиенту нужен только индекс сущностей для автодополнения.
 */
export function SessionDescription({
  number,
  description,
  nodes,
  children,
}: {
  number: number;
  description: string | null;
  /** Сущности кампании для автодополнения `[[`. */
  nodes: PickerNode[];
  /** Описание, уже отрисованное на сервере через <WikiText>. */
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { canWrite } = useQuickEntry();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const errorLine = error ? (
    <MonoLabel size={10} tracking="0.06em" tone="accent" block>
      {error}
    </MonoLabel>
  ) : null;

  if (!open) {
    /* Разлогиненному пустой блок с недоступной кнопкой читался бы как
     * поломка: описания нет — нет и раздела. */
    if (!description && !canWrite) return null;

    return (
      <section className={styles.description}>
        <MonoLabel size={10} tracking="0.14em" block>
          Описание
        </MonoLabel>

        {description ? (
          <p className={styles.descriptionBody}>{children}</p>
        ) : (
          <MonoLabel size={10} tracking="0.06em" tone="faint" block>
            Описания пока нет
          </MonoLabel>
        )}

        {errorLine}

        {canWrite ? (
          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.action}
              disabled={pending}
              onClick={() => {
                setError(null);
                setDraft(description ?? '');
                setOpen(true);
              }}
            >
              {description ? 'Править описание' : 'Добавить описание'}
            </button>

            {description ? (
              <button
                type="button"
                className={styles.danger}
                disabled={pending}
                onClick={() => setConfirming(true)}
              >
                УДАЛИТЬ ОПИСАНИЕ
              </button>
            ) : null}
          </div>
        ) : null}

        {confirming ? (
          <ConfirmDialog
            title="Удалить описание?"
            body="Пересказ сессии исчезнет со страницы. Записи, кадры и цитаты этой игры останутся на месте."
            quoted={description}
            confirmLabel="УДАЛИТЬ"
            pending={pending}
            onConfirm={() =>
              startTransition(async () => {
                const result = await deleteSessionDescription(number);
                setConfirming(false);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setDraft('');
                router.refresh();
              })
            }
            onCancel={() => setConfirming(false)}
          />
        ) : null}
      </section>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await saveSessionDescription(number, draft);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setOpen(false);
          router.refresh();
        });
      }}
    >
      <MonoLabel size={9} tracking="0.14em" block>
        Описание
      </MonoLabel>

      <WikiTextarea
        value={draft}
        onChange={setDraft}
        nodes={nodes}
        onCreateNode={createDraftNode}
        rows={6}
        placeholder="О чём была игра? Ссылки — в [[скобках]]"
      />

      {errorLine}

      <div className={styles.buttons}>
        <button type="submit" className={styles.submit} disabled={pending}>
          СОХРАНИТЬ
        </button>
        <button
          type="button"
          className={styles.cancel}
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setError(null);
            setDraft(description ?? '');
          }}
        >
          ОТМЕНА
        </button>
      </div>
    </form>
  );
}
