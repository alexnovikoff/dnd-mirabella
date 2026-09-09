'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MonoLabel } from '@/components/primitives';
import { signInWithPassword } from '@/lib/actions/auth';
import styles from './login.module.css';

export function LoginForm({ names }: { names: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={styles.form}
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await signInWithPassword(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.replace(params.get('from') ?? '/');
          router.refresh();
        });
      }}
    >
      <label>
        <MonoLabel size={9} tracking="0.14em" block>
          Кто вы
        </MonoLabel>
        <select className={styles.field} name="name" defaultValue={names[0]} required>
          {names.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <label>
        <MonoLabel size={9} tracking="0.14em" block>
          Пароль
        </MonoLabel>
        <input
          className={styles.field}
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </label>

      {error ? (
        <div className={styles.error}>
          <MonoLabel size={10} tracking="0.06em" tone="onAccent">
            {error}
          </MonoLabel>
        </div>
      ) : null}

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'ПРОВЕРЯЕМ…' : 'ВОЙТИ'}
      </button>
    </form>
  );
}
