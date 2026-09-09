import { redirect } from 'next/navigation';
import { Screen } from '@/components/shell/Screen';
import { MonoLabel } from '@/components/primitives';
import { getViewer } from '@/lib/viewer';
import { PasswordForm } from './PasswordForm';
import styles from './account.module.css';

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?from=/account');

  return (
    <Screen
      title="Учётная запись"
      note="Пароль у каждого свой. Тот, что раздала первая настройка, — временный: смените его здесь."
    >
      <div className={styles.card}>
        <div className={styles.who}>
          <span className={styles.avatar} aria-hidden="true">
            {viewer.initial}
          </span>
          <div>
            <div className={styles.name}>{viewer.name}</div>
            <MonoLabel size={9} tracking="0.08em" tone="faint" block>
              {viewer.role === 'dm' ? 'Мастер · видит всё' : 'Игрок'}
            </MonoLabel>
          </div>
        </div>

        <PasswordForm />
      </div>

      <MonoLabel size={9} tracking="0.06em" tone="faint" uppercase={false} block>
        Пароль забыт — сбрасывает мастер: pnpm auth:password «Имя». Из интерфейса чужой пароль не
        меняется.
      </MonoLabel>
    </Screen>
  );
}
