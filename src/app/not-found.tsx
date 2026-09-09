import Link from 'next/link';
import { MonoLabel } from '@/components/primitives';
import styles from './states.module.css';

export default function NotFound() {
  return (
    <div className={styles.screen}>
      <div className={styles.empty}>
        <MonoLabel size={11} tracking="0.1em">
          Такой страницы в хронике нет
        </MonoLabel>
        <MonoLabel size={9} tracking="0.08em" tone="faint">
          Возможно, сущность переименовали или запись удалили
        </MonoLabel>
        <Link href="/">
          <MonoLabel size={9} tracking="0.08em" tone="accent">
            ← Вернуться к хронике
          </MonoLabel>
        </Link>
      </div>
    </div>
  );
}
