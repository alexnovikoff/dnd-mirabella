'use client';

/* Просмотр кадра во весь экран: «Галерея» и «Достижения» открывают его
 * одинаково — кадр, подпись, мета и листание стрелками. */

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { MonoLabel } from './MonoLabel';
import styles from './Lightbox.module.css';

/* Пропорция рамки, пока ни один кадр не загрузился: портретная, как плитка
 * «Галереи». Размеров файла в базе нет — настоящую узнаём по загрузке. */
const FALLBACK_RATIO = 3 / 4;

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

  /* Пропорция последнего загруженного кадра. При листании рамка держит её,
   * пока грузится следующий, — иначе она прыгала бы дважды: к запасной
   * пропорции и уже потом к настоящей. Плейсхолдеру без файла чужая
   * пропорция ни к чему — у него запасная. */
  const [loaded, setLoaded] = useState<{ url: string; ratio: number } | null>(null);
  const ready = url !== null && loaded?.url === url;
  const ratio = url && loaded ? loaded.ratio : FALLBACK_RATIO;

  return (
    <div
      className={styles.lightbox}
      style={{ '--ratio': ratio } as React.CSSProperties}
      onClick={onClose}
    >
      <div
        className={ready ? `${styles.frame} ${styles.ready}` : styles.frame}
        onClick={(event) => event.stopPropagation()}
      >
        {url ? (
          <Image
            src={url}
            alt={alt ?? caption ?? ''}
            fill
            className={styles.image}
            sizes="100vw"
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              if (naturalWidth && naturalHeight) {
                setLoaded({ url, ratio: naturalWidth / naturalHeight });
              }
            }}
          />
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
