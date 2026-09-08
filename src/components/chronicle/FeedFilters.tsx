import Link from 'next/link';
import { FEED_FILTERS, type FeedFilter } from '@/lib/queries/chronicle';
import styles from './FeedFilters.module.css';

/** Фильтр живёт в строке запроса: ссылка вместо состояния — работает без JS
 *  и остаётся в истории браузера. */
export function FeedFilters({ active }: { active: FeedFilter }) {
  return (
    <div className={styles.filters}>
      {FEED_FILTERS.map((filter) => {
        const isActive = filter.id === active;
        return (
          <Link
            key={filter.id}
            href={filter.id === 'all' ? '/' : `/?filter=${filter.id}`}
            className={isActive ? `${styles.filter} ${styles.active}` : styles.filter}
            aria-current={isActive ? 'true' : undefined}
            scroll={false}
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}
