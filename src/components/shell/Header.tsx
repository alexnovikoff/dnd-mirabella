'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AccountChip } from './AccountChip';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { NAV, actionFor, isActive } from '@/lib/nav';
import type { Viewer } from '@/lib/auth-shared';
import styles from './Header.module.css';

export function Header({
  campaignTitle,
  seal,
  sessionLabel,
  viewer,
}: {
  campaignTitle: string;
  seal: string;
  sessionLabel: string;
  viewer: Viewer | null;
}) {
  const pathname = usePathname();
  const quickEntry = useQuickEntry();

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.seal} aria-hidden="true">
          {seal}
        </span>
        <Link href="/" className={styles.title}>
          {campaignTitle}
        </Link>
      </div>

      <nav className={styles.nav} aria-label="Разделы кампании">
        {NAV.map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className={styles.actions}>
        {sessionLabel ? <span className={styles.session}>{sessionLabel}</span> : null}
        {/* Разлогиненным писать нечем — контент только для чтения. */}
        {viewer ? (
          <button type="button" className={styles.action} onClick={quickEntry.open}>
            {actionFor(pathname)}
          </button>
        ) : null}
        <AccountChip viewer={viewer} />
      </div>
    </header>
  );
}
