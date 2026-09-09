import Link from 'next/link';
import { Suspense } from 'react';
import { MonoLabel } from '@/components/primitives';
import { LoginForm } from './LoginForm';
import { getCampaign } from '@/lib/queries/chronicle';
import { getAccountNames } from '@/lib/queries/users';
import styles from './login.module.css';

export default async function LoginPage() {
  const [campaign, names] = await Promise.all([getCampaign(), getAccountNames()]);

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>{campaign?.title ?? 'Вход'}</h1>
      <p className={styles.note}>
        Записи в хронику добавляют участники кампании. Без входа страницы открыты только для чтения.
      </p>

      <Suspense fallback={null}>
        <LoginForm names={names} />
      </Suspense>

      <div className={styles.back}>
        <Link href="/">
          <MonoLabel size={9} tracking="0.08em" tone="accent">
            ← Вернуться к хронике
          </MonoLabel>
        </Link>
      </div>
    </div>
  );
}
