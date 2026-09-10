'use client';

/* Виджет «Галерея» в сайдбаре «Хроники». Сетка из макета — 3×2, где последняя
 * ячейка занята дроп-зоной, то есть кадров на странице ровно пять. Свежих
 * кадров обычно больше, поэтому страницы листаются стрелками, не уводя со
 * страницы: за всей галереей ведёт заголовок. */

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { DropZone, MonoLabel } from '@/components/primitives';
import styles from './Sidebar.module.css';

/** Кадров на странице: шестая ячейка сетки — дроп-зона. */
export const GALLERY_PAGE = 5;

/** Сколько кадров тянем из базы: четыре страницы листания. Больше в сайдбаре
 *  никто не отлистывает — дальше открывают саму «Галерею». */
export const GALLERY_PREVIEW_LIMIT = GALLERY_PAGE * 4;

export type GalleryPreviewImage = { id: string; caption: string | null; url: string | null };

export function SidebarGallery({
  total,
  images,
}: {
  total: number;
  images: GalleryPreviewImage[];
}) {
  const [page, setPage] = useState(0);

  const pages = Math.max(1, Math.ceil(images.length / GALLERY_PAGE));
  const start = page * GALLERY_PAGE;
  const shown = images.slice(start, start + GALLERY_PAGE);

  return (
    <section className={styles.block}>
      <div className={styles.blockHead}>
        {/* Заголовок ведёт в «Галерею»: в сайдбаре помещается только горсть. */}
        <Link href="/gallery" className={styles.blockTitle}>
          <MonoLabel size={10} tracking="0.14em" block>
            {`Галерея · ${total}`}
          </MonoLabel>
        </Link>

        {pages > 1 ? (
          <div className={styles.pager}>
            <button
              type="button"
              className={styles.pagerButton}
              aria-label="Предыдущие кадры"
              title="Предыдущие кадры"
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              ←
            </button>
            <button
              type="button"
              className={styles.pagerButton}
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

      <div className={styles.grid}>
        {shown.map((image) => (
          <Link
            key={image.id}
            href="/gallery"
            className={styles.cell}
            title={image.caption ?? undefined}
          >
            {/* Кадр без файла оставляет ячейке штриховку — так же, как
                плейсхолдер до загрузки. */}
            {image.url ? (
              <Image
                src={image.url}
                alt={image.caption ?? ''}
                fill
                sizes="96px"
                className={styles.photo}
              />
            ) : null}
          </Link>
        ))}
        <DropZone variant="cell" label="Drop img" />
      </div>
    </section>
  );
}
