import { FilterChips } from '@/components/primitives';
import { FEED_FILTERS, type FeedFilter } from '@/lib/queries/chronicle';

/** Фильтр живёт в строке запроса: ссылка вместо состояния — работает без JS
 *  и остаётся в истории браузера. */
export function FeedFilters({ active }: { active: FeedFilter }) {
  return (
    <FilterChips
      size="sm"
      activeId={active}
      ariaLabel="Фильтр ленты"
      items={FEED_FILTERS.map((filter) => ({
        id: filter.id,
        label: filter.label,
        href: filter.id === 'all' ? '/' : `/?filter=${filter.id}`,
      }))}
    />
  );
}
