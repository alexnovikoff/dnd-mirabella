'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MonoLabel } from '@/components/primitives';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { updateCharacter } from '@/lib/actions/nodes';
import picker from '@/components/editor/Picker.module.css';
import styles from './Character.module.css';

export function CharacterEditor({
  nodeId,
  name,
  race,
  classes,
  level,
  bio,
  sinceSession,
}: {
  nodeId: string;
  name: string;
  race: string | null;
  classes: string | null;
  level: number | null;
  bio: string | null;
  sinceSession: number | null;
}) {
  const router = useRouter();
  const { canWrite } = useQuickEntry();
  const [open, setOpen] = useState(false);
  const initial = {
    name,
    race: race ?? '',
    classes: classes ?? '',
    level: level === null ? '' : String(level),
    bio: bio ?? '',
    sinceSession: sinceSession === null ? '' : String(sinceSession),
  };
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canWrite) return null;

  if (!open) {
    return (
      <button type="button" className={styles.compactAction} onClick={() => setOpen(true)}>
        Править
      </button>
    );
  }

  const field = (key: keyof typeof form, label: string, placeholder?: string) => (
    <label className={styles.formField}>
      <MonoLabel size={9} tracking="0.14em" block>
        {label}
      </MonoLabel>
      <input
        className={picker.field}
        value={form[key]}
        placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [key]: e.currentTarget.value })}
      />
    </label>
  );

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await updateCharacter(nodeId, form);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setOpen(false);
          /* Слаг мог смениться вместе с именем. */
          router.replace(`/characters/${result.slug}`);
          router.refresh();
        });
      }}
    >
      <div className={styles.formRow}>
        {field('name', 'Имя')}
        {field('race', 'Раса', 'Тифлинг')}
        {field('classes', 'Классы', 'Плут · Монах')}
      </div>

      <div className={styles.formRow}>
        {field('level', 'Уровень', '6')}
        {field('sinceSession', 'Играет с сессии', '1')}
      </div>

      <label className={styles.formField}>
        <MonoLabel size={9} tracking="0.14em" block>
          Описание
        </MonoLabel>
        <textarea
          className={`${picker.field} ${styles.noteTextarea}`}
          value={form.bio}
          placeholder="Пара строк о персонаже"
          onChange={(e) => setForm({ ...form, bio: e.currentTarget.value })}
        />
      </label>

      {form.name !== name ? (
        <MonoLabel size={9} tracking="0.06em" tone="faint" block>
          {`Прежнее имя «${name}» уйдёт в алиасы — [[ссылки]] в старых записях не сломаются`}
        </MonoLabel>
      ) : null}

      {error ? (
        <MonoLabel size={10} tracking="0.06em" tone="accent" block>
          {error}
        </MonoLabel>
      ) : null}

      <div className={styles.formButtons}>
        <button type="submit" className={styles.submit} disabled={pending}>
          СОХРАНИТЬ
        </button>
        <button
          type="button"
          className={styles.cancel}
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setForm(initial);
            setError(null);
          }}
        >
          ОТМЕНА
        </button>
      </div>
    </form>
  );
}
