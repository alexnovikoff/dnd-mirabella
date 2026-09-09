'use client';

import { MonoLabel } from '@/components/primitives';
import styles from './states.module.css';

export default function ErrorScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const notAuthorized = error.message.includes('Нужно войти');

  return (
    <div className={styles.screen}>
      <div className={styles.plate}>
        <MonoLabel size={10} tracking="0.14em" tone="onAccentDim">
          {notAuthorized ? 'Нужен вход' : 'Что-то сломалось'}
        </MonoLabel>
        <p className={styles.plateTitle}>
          {notAuthorized ? 'Записи добавляют только участники кампании' : 'Страница не собралась'}
        </p>
        <MonoLabel size={10} tracking="0.06em" tone="onAccentDim">
          {error.message}
        </MonoLabel>
        <div>
          <button type="button" className={styles.button} onClick={reset}>
            ПОПРОБОВАТЬ СНОВА
          </button>
        </div>
      </div>
    </div>
  );
}
