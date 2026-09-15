import Link from 'next/link';
import styles from './AboutLink.module.css';

/** «О проекте» — подпись, приклеенная к правому нижнему углу окна: видна на любом
 *  экране, как бы ни был длинен лист. В шапку не идёт — шесть вкладок там из
 *  README, и это не раздел кампании. */
export function AboutLink({ aboveQuickEntryBar }: { aboveQuickEntryBar: boolean }) {
  return (
    <Link
      href="/about"
      className={aboveQuickEntryBar ? `${styles.link} ${styles.raised}` : styles.link}
    >
      О проекте
    </Link>
  );
}
