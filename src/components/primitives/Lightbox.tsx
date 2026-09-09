'use client';

/* Просмотр кадра во весь экран: «Галерея» и «Достижения» открывают его
 * одинаково — кадр, подпись, мета и листание стрелками. */

import { useEffect } from 'react';
import Image from 'next/image';
import { MonoLabel } from './MonoLabel';
import styles from './Lightbox.module.css';

export type LightboxProps = {
  url: string | null;
  caption: string | null;
  /** Строка под подписью: «АРТ · С14 · МЕТЕЛЬ». */
  meta?: string;
  alt?: string;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
};

export function Lightbox({ url, caption, meta, alt, onPrev, onNext, onClose }: LightboxProps) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') onNext();
      if (event.key === 'ArrowLeft') onPrev();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onNext, onPrev]);

  return (
    <div className={styles.lightbox} onClick={onClose}>
      <div className={styles.frame} onClick={(event) => event.stopPropagation()}>
        {url ? (
          <Image src={url} alt={alt ?? caption ?? ''} fill className={styles.image} sizes="100vw" />
        ) : (
          <MonoLabel size={11} tracking="0.1em">
            {caption ?? 'Изображение ещё не загружено'}
          </MonoLabel>
        )}
      </div>
      <div className={styles.bar} onClick={(event) => event.stopPropagation()}>
        <button type="button" className={styles.navButton} onClick={onPrev}>
          ←
        </button>
        <span className={styles.caption}>
          {caption}
          {meta ? (
            <>
              <br />
              <MonoLabel size={9} tracking="0.08em" tone="onAccentDim">
                {meta}
              </MonoLabel>
            </>
          ) : null}
        </span>
        <button type="button" className={styles.navButton} onClick={onNext}>
          →
        </button>
        <button type="button" className={styles.navButton} onClick={onClose}>
          ×
        </button>
      </div>
    </div>
  );
}
