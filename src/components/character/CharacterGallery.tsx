'use client';

/* Блок «Галерея» в сайдбаре страницы персонажа. Сетка 3×2, как у виджета
 * «Хроники», и так же листается стрелками в шапке: персонажа называют
 * в подписях многих кадров, а за всей галереей ведёт каждая плитка. */

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MonoLabel } from '@/components/primitives';
import sidebar from '@/components/chronicle/Sidebar.module.css';
import styles from './Character.module.css';

/** Кадров на странице: сетка 3×2 заполняется целиком. */
const PAGE = 6;

export type CharacterGalleryImage = { id: string; caption: string | null; url: string | null };

export function CharacterGallery({ images }: { images: CharacterGalleryImage[] }) {
  const [page, setPage] = useState(0);

  const pages = Math.max(1, Math.ceil(images.length / PAGE));
  const start = page * PAGE;
  const shown = images.slice(start, start + PAGE);

  return (
    <div className={styles.block}>
      <div className={sidebar.blockHead}>
        <MonoLabel size={10} tracking="0.14em" block>
          {`Галерея · ${images.length}`}
        </MonoLabel>

        {pages > 1 ? (
          <div className={sidebar.pager}>
            <button
              type="button"
              className={sidebar.pagerButton}
              aria-label="Предыдущие кадры"
              title="Предыдущие кадры"
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              ←
            </button>
            <button
              type="button"
              className={sidebar.pagerButton}
              aria-label="Следующие кадры"
              title="Следующие кадры"
              disabled={page >= pages - 1}
              onClick={() => setPage((current) => Math.min(pages - 1, current + 1))}
            >
              →
            </button>
          </div>
        ) : null}
      </div>

      <div className={styles.grid3}>
        {shown.map((image) => (
          <Link
            key={image.id}
            href="/gallery"
            className={styles.cell}
            title={image.caption ?? undefined}
          >
            {/* Кадр без файла оставляет ячейке штриховку плейсхолдера. */}
            {image.url ? (
              <Image
                src={image.url}
                alt={image.caption ?? ''}
                fill
                sizes="(max-width: 1023px) 33vw, 96px"
                className={styles.photo}
              />
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
