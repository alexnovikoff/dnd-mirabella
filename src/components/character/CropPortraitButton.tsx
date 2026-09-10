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
      >
        КАДР
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
