'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MonoLabel } from '@/components/primitives';
import { signOutAction } from '@/lib/actions/auth';
import type { Viewer } from '@/lib/auth-shared';
import styles from './AccountChip.module.css';

/** Чип аккаунта. `viewer === null` — разлогинен: кнопка «ВОЙТИ». */
export function AccountChip({ viewer }: { viewer: Viewer | null }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!viewer) {
    return (
      <Link href="/login" className={styles.signIn}>
        ВОЙТИ
      </Link>
    );
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.chip}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.avatar} aria-hidden="true">
          {viewer.initial}
        </span>
        {viewer.name}
        <span className={styles.caret} aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className={styles.menu} role="menu">
          <div className={styles.role}>
            <MonoLabel size={9} tracking="0.08em" tone="faint">
              {viewer.role === 'dm' ? 'Мастер · видит всё' : 'Игрок'}
            </MonoLabel>
          </div>

          {viewer.characterSlug ? (
            <Link
              href={`/characters/${viewer.characterSlug}`}
              className={styles.menuItem}
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              Профиль
            </Link>
          ) : null}

          <form action={signOutAction}>
            <button type="submit" className={styles.menuItem} role="menuitem">
              Выйти
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
