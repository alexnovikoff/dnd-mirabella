import type { StubUser } from '@/lib/campaign';
import styles from './AccountChip.module.css';

/** Чип аккаунта в шапке. `user === null` — разлогиненное состояние.
 *  Меню (профиль, выход) и настоящий вход — этап 9. */
export function AccountChip({ user }: { user: StubUser | null }) {
  if (!user) {
    return (
      <button type="button" className={styles.signIn}>
        ВОЙТИ
      </button>
    );
  }

  return (
    <button type="button" className={styles.chip}>
      <span className={styles.avatar} aria-hidden="true">
        {user.initial}
      </span>
      {user.name}
      <span className={styles.caret} aria-hidden="true">
        ▾
      </span>
    </button>
  );
}
