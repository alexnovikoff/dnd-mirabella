import Link from 'next/link';
import styles from './Footer.module.css';

/** Подвал страницы: одна неприметная ссылка на столе в правом нижнем углу. В шапку
 *  «О проекте» не идёт — шесть вкладок там из README, и это не раздел кампании. */
export function Footer() {
  return (
    <footer className={styles.footer}>
      <Link href="/about" className={styles.link}>
        О проекте
      </Link>
    </footer>
  );
}
