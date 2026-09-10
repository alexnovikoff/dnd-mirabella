'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MonoLabel } from '@/components/primitives';
import { ConfirmDialog } from '@/components/editor/ConfirmDialog';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { deleteSession, updateSession } from '@/lib/actions/sessions';
import picker from '@/components/editor/Picker.module.css';
import styles from './Session.module.css';

export function SessionEditor({
  number,
  title,
  date,
  location,
}: {
  number: number;
  title: string | null;
  date: string | null;
  location: string | null;
}) {
  const router = useRouter();
  const { canWrite } = useQuickEntry();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: title ?? '',
    date: date ?? '',
    location: location ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!canWrite) return null;

  if (!open) {
    return (
      <button type="button" className={styles.action} onClick={() => setOpen(true)}>
        Править сессию
      </button>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await updateSession(number, form);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setOpen(false);
          router.refresh();
        });
      }}
    >
      <div className={styles.row}>
        <label className={styles.field}>
          <MonoLabel size={9} tracking="0.14em" block>
            Название
          </MonoLabel>
          <input
            className={picker.field}
            value={form.title}
            placeholder="Базар Халь-Раши"
            onChange={(e) => setForm({ ...form, title: e.currentTarget.value })}
          />
        </label>

        <label className={styles.field}>
          <MonoLabel size={9} tracking="0.14em" block>
            Дата
          </MonoLabel>
          <input
            className={picker.field}
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.currentTarget.value })}
          />
        </label>

        <label className={styles.field}>
          <MonoLabel size={9} tracking="0.14em" block>
            Место
          </MonoLabel>
          <input
            className={picker.field}
            value={form.location}
            placeholder="Где играли"
            onChange={(e) => setForm({ ...form, location: e.currentTarget.value })}
          />
        </label>
      </div>

      {error ? (
        <MonoLabel size={10} tracking="0.06em" tone="accent" block>
          {error}
        </MonoLabel>
      ) : null}

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
            setForm({ title: title ?? '', date: date ?? '', location: location ?? '' });
          }}
        >
          ОТМЕНА
        </button>
        {/* Удаление всей игры прячется за «Править сессию»: случайно нажать
            его из шапки нельзя, а тот, кто открыл шапку на правку, ищет его
            именно здесь. */}
        <button
          type="button"
          className={`${styles.danger} ${styles.buttonEnd}`}
          disabled={pending}
          onClick={() => setConfirming(true)}
        >
          УДАЛИТЬ СЕССИЮ
        </button>
      </div>

      {confirming ? (
        <ConfirmDialog
          title="Удалить сессию?"
          body="Игра исчезнет из списка, номера соседних сессий не сдвинутся. Записи, цитаты и кадры этого вечера останутся в хронике и галерее — но окажутся вне сессий."
          quoted={title ? `Сессия ${number} — ${title}` : `Сессия ${number}`}
          confirmLabel="УДАЛИТЬ"
          pending={pending}
          onConfirm={() =>
            startTransition(async () => {
              const result = await deleteSession(number);
              if (!result.ok) {
                setConfirming(false);
                setError(result.error);
                return;
              }
              /* Страницы удалённой сессии больше нет — уходим к списку. */
              router.push('/sessions');
              router.refresh();
            })
          }
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </form>
  );
}
