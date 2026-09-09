'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MonoLabel } from '@/components/primitives';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { updateSession } from '@/lib/actions/sessions';
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
            setForm({ title: title ?? '', date: date ?? '', location: location ?? '' });
          }}
        >
          ОТМЕНА
        </button>
      </div>
    </form>
  );
}
