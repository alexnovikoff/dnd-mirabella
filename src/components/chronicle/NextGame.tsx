'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MonoLabel } from '@/components/primitives';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { deleteNextGame, saveNextGame } from '@/lib/actions/campaign';
import styles from './NextGame.module.css';

/**
 * Анонс следующей игры — первое, что видно над лентой «Хроники».
 *
 * Единственная строка на сайте, которая смотрит вперёд, а не назад, поэтому
 * стоит выше всего остального и держит акцентный кант: на общем пергаменте
 * её нужно замечать, не вчитываясь.
 *
 * Правит её любой вошедший — дату за столом назначают вместе. Разлогиненному
 * пустой блок не показываем: без кнопки он читался бы как поломка.
 */
export function NextGame({ nextGame }: { nextGame: string | null }) {
  const router = useRouter();
  const { canWrite } = useQuickEntry();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(nextGame ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const errorLine = error ? (
    <MonoLabel size={10} tracking="0.06em" tone="accent" block>
      {error}
    </MonoLabel>
  ) : null;

  if (!open) {
    if (!nextGame && !canWrite) return null;

    return (
      <section className={styles.card} aria-label="Следующая игра">
        <div className={styles.row}>
          <div className={styles.text}>
            <MonoLabel size={11} tracking="0.14em" tone="accent" block>
              Следующая игра
            </MonoLabel>

            {nextGame ? (
              <p className={styles.date}>{nextGame}</p>
            ) : (
              <MonoLabel size={10} tracking="0.06em" tone="faint" block>
                Дата ещё не назначена
              </MonoLabel>
            )}
          </div>

          {/* Одна кнопка на весь блок: очистка живёт внутри правки, рядом
              с «Сохранить», — снаружи анонс только читают. */}
          {canWrite ? (
            <button
              type="button"
              className={styles.action}
              disabled={pending}
              onClick={() => {
                setError(null);
                setDraft(nextGame ?? '');
                setOpen(true);
              }}
            >
              {nextGame ? 'Править' : 'Назначить'}
            </button>
          ) : null}
        </div>

        {errorLine}
      </section>
    );
  }

  return (
    <form
      className={`${styles.card} ${styles.form}`}
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await saveNextGame(draft);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setOpen(false);
          router.refresh();
        });
      }}
    >
      <MonoLabel size={11} tracking="0.14em" tone="accent" block>
        Следующая игра
      </MonoLabel>

      {/* Строка свободная: день недели и время пишут словами, как
          договорились за столом. */}
      <input
        className={styles.field}
        value={draft}
        autoFocus
        aria-label="Когда следующая игра"
        placeholder="16 сентября (среда), старт в 20.00"
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            setError(null);
            setDraft(nextGame ?? '');
          }
        }}
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
            setDraft(nextGame ?? '');
          }}
        >
          ОТМЕНА
        </button>

        {/* Отодвинута в конец ряда: рядом с «Сохранить» её нажимают не глядя.
            Подтверждения нет — стирается одна строка, и вернуть её значит
            просто набрать дату заново. */}
        {nextGame ? (
          <button
            type="button"
            className={`${styles.danger} ${styles.buttonEnd}`}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await deleteNextGame();
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setDraft('');
                setOpen(false);
                router.refresh();
              })
            }
          >
            ОЧИСТИТЬ
          </button>
        ) : null}
      </div>
    </form>
  );
}
