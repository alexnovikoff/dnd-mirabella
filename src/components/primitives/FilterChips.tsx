import Link from 'next/link';
import styles from './FilterChips.module.css';

export type FilterChip = {
  id: string;
  label: string;
  href: string;
  /** Тумблер вместо фильтра: включённый заливается акцентом. */
  toggle?: boolean;
  on?: boolean;
};

export function FilterChips({
  items,
  activeId,
  size = 'md',
  activeStyle = 'outline',
  ariaLabel,
}: {
  items: FilterChip[];
  activeId?: string;
  size?: 'sm' | 'md';
  /** 'solid' — активный чип залит акцентом: так выглядят подтабы «Базы знаний». */
  activeStyle?: 'outline' | 'solid';
  ariaLabel?: string;
}) {
  return (
    <div
      className={`${styles.row} ${size === 'sm' ? styles.sm : styles.md}`}
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const active = item.toggle ? item.on : item.id === activeId;
        const solid =
          (item.toggle && item.on) || (!item.toggle && active && activeStyle === 'solid');
        const className = [
          styles.chip,
          solid ? styles.toggleOn : undefined,
          !item.toggle && active && activeStyle === 'outline' ? styles.active : undefined,
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <Link
            key={item.id}
            href={item.href}
            className={className}
            aria-current={!item.toggle && active ? 'true' : undefined}
            aria-pressed={item.toggle ? item.on : undefined}
            scroll={false}
          >
            {item.toggle && item.on ? <span className={styles.marker} aria-hidden="true" /> : null}
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
