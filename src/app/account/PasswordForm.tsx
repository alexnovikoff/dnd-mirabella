'use client';

import { useRef, useState, useTransition } from 'react';
import { MonoLabel } from '@/components/primitives';
import { changePassword } from '@/lib/actions/auth';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth-shared';
import styles from './account.module.css';

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      className={styles.form}
      action={(formData) => {
        setError(null);
        setDone(false);
        startTransition(async () => {
          const result = await changePassword(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          /* Поля чистим сразу: пароль не должен остаться в форме. */
          formRef.current?.reset();
          setDone(true);
        });
      }}
    >
      <label className={styles.field}>
        <MonoLabel size={9} tracking="0.14em" block>
          Текущий пароль
        </MonoLabel>
        <input
          className={styles.input}
          type="password"
          name="current"
          autoComplete="current-password"
          required
        />
      </label>

      <label className={styles.field}>
        <MonoLabel size={9} tracking="0.14em" block>
          Новый пароль
        </MonoLabel>
        <input
          className={styles.input}
          type="password"
          name="next"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
      </label>

      <label className={styles.field}>
        <MonoLabel size={9} tracking="0.14em" block>
          Ещё раз
        </MonoLabel>
        <input
          className={styles.input}
          type="password"
          name="again"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
      </label>

      <MonoLabel size={9} tracking="0.06em" tone="faint" uppercase={false} block>
        {`Не короче ${MIN_PASSWORD_LENGTH} символов.`}
      </MonoLabel>

      {error ? <div className={styles.error}>{error}</div> : null}

      {done ? (
        <MonoLabel size={10} tracking="0.08em" tone="accent" block>
          Пароль изменён
        </MonoLabel>
      ) : null}

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'МЕНЯЮ…' : 'СМЕНИТЬ ПАРОЛЬ'}
      </button>
    </form>
  );
}
