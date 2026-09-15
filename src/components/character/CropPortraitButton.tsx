'use client';

import { useState } from 'react';
import { CropDialog } from './CropDialog';
import type { CropRect } from '@/lib/crop';
import styles from './Party.module.css';

/** Кнопка поверх портрета в списке партии. Лежит рядом со ссылкой на
 *  персонажа, а не внутри неё: кнопка внутри ссылки — и клик, и разметка
 *  ломаются одновременно. */
export function CropPortraitButton({
  nodeId,
  name,
  source,
  crop,
}: {
  nodeId: string;
  name: string;
  source: string;
  crop: CropRect | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.cropButton}
        onClick={() => setOpen(true)}
        title={`Кадрировать портрет: ${name}`}
        aria-label={`Кадрировать портрет: ${name}`}
      >
        {/* Две встречные скобки — привычный знак кадрирования. Углы прямые,
         * как у всего интерфейса. Подпись у иконки одна — aria-label. */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M6 2v16h16" />
          <path d="M18 22V6H2" />
        </svg>
      </button>

      {open ? (
        <CropDialog
          nodeId={nodeId}
          name={name}
          source={source}
          crop={crop}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
