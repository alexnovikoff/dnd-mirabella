'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MonoLabel } from '@/components/primitives';
import {
  clampCrop,
  cropFileType,
  cropPixels,
  moveCrop,
  resizeCrop,
  FULL_CROP,
  type CropRect,
  type Handle,
} from '@/lib/crop';
import { savePortraitCrop } from '@/lib/actions/characters';
import styles from './CropDialog.module.css';

const HANDLES: Handle[] = ['nw', 'ne', 'sw', 'se'];

/** Шаг стрелок: обычный — подвинуть, с Shift — перебросить. */
const NUDGE = 0.01;
const NUDGE_FAST = 0.05;

/** За что тянут: 'move' — за саму рамку, угол — за маркер. */
type Grip = Handle | 'move';

/** Кадрирование портрета. Режем в браузере и отправляем готовый файл:
 *  на сервере нет ни sharp, ни canvas, а исходник и так уже у клиента. */
export function CropDialog({
  nodeId,
  name,
  source,
  crop,
  onClose,
}: {
  nodeId: string;
  name: string;
  /** Оригинал, а не текущий кадр: режем всегда из него. */
  source: string;
  crop: CropRect | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const imageRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<CropRect>(crop ?? FULL_CROP);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  /* Слушатели вешаем прямо в обработчике нажатия и на документ.
   *
   * На документ — потому что курсор регулярно выносит за рамку и за
   * картинку, а тянуть при этом надо продолжать. Сразу, а не эффектом от
   * состояния, — потому что между нажатием и первым движением у React есть
   * коммит, и быстрый рывок мышью успевает в него провалиться. */
  const grab = useCallback(
    (event: React.PointerEvent, grip: Grip) => {
      event.preventDefault();
      event.stopPropagation();

      const stage = stageRef.current;
      if (!stage) return;

      /* preventDefault снимает и фокус заодно — возвращаем его руками:
       * дотянув рамку мышью, доводить её стрелками удобнее без Tab. */
      frameRef.current?.focus();

      /* Отсчёт от рамки на момент нажатия, а не по шагам: иначе округления
       * накапливаются и рамка «плывёт» за курсором. */
      const start = rect;
      const fromX = event.clientX;
      const fromY = event.clientY;

      function onMove(move: PointerEvent) {
        const box = stage!.getBoundingClientRect();
        const dx = (move.clientX - fromX) / box.width;
        const dy = (move.clientY - fromY) / box.height;
        setRect(grip === 'move' ? moveCrop(start, dx, dy) : resizeCrop(start, grip, dx, dy));
      }

      function stop() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', stop);
        document.removeEventListener('pointercancel', stop);
      }

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', stop);
      document.addEventListener('pointercancel', stop);
    },
    [rect],
  );

  function onArrows(event: React.KeyboardEvent) {
    const step = event.shiftKey ? NUDGE_FAST : NUDGE;
    const shift: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = shift[event.key];
    if (!move) return;

    event.preventDefault();
    setRect((current) => moveCrop(current, move[0], move[1]));
  }

  function save() {
    const image = imageRef.current;
    if (!image || !ready) return;

    setError(null);
    const { sx, sy, sw, sh } = cropPixels(rect, image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;

    const context = canvas.getContext('2d');
    if (!context) {
      setError('Браузер не дал вырезать кадр');
      return;
    }
    context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);

    const { type, name: fileName } = cropFileType(source);
    /* toBlob на «испачканном» холсте бросает SecurityError — это значит,
     * что хранилище отдало картинку без CORS. Молча терять кадр нельзя. */
    let blob: Promise<Blob | null>;
    try {
      blob = new Promise((resolve) => canvas.toBlob(resolve, type, 0.92));
    } catch {
      setError('Хранилище не отдало оригинал для обработки');
      return;
    }

    startTransition(async () => {
      const data = await blob;
      if (!data) {
        setError('Кадр не получился');
        return;
      }

      const form = new FormData();
      form.append('nodeId', nodeId);
      form.append('file', new File([data], fileName, { type }));
      form.append('crop', JSON.stringify(rect));

      const result = await savePortraitCrop(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className={styles.scrim}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={`Кадр: ${name}`}>
        <h2 className={styles.title}>Кадр портрета</h2>
        <MonoLabel size={9} tracking="0.1em" tone="faint" block>
          {name}
        </MonoLabel>

        <div className={styles.stageWrap}>
          <div ref={stageRef} className={styles.stage}>
            {/* next/image здесь не подходит: нужен оригинал в исходном
             * разрешении и одним элементом, из которого читает canvas.
             * crossOrigin — ради Blob: без него холст «пачкается». */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={source}
              alt=""
              crossOrigin="anonymous"
              className={styles.image}
              draggable={false}
              onLoad={() => setReady(true)}
              onError={() => setError('Не удалось открыть оригинал')}
            />

            <div
              ref={frameRef}
              className={styles.window}
              style={{
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.w * 100}%`,
                height: `${rect.h * 100}%`,
              }}
              role="application"
              aria-label="Рамка кадра: тяните мышью, двигайте стрелками"
              tabIndex={0}
              onPointerDown={(event) => grab(event, 'move')}
              onKeyDown={onArrows}
            >
              {HANDLES.map((handle) => (
                <span
                  key={handle}
                  className={`${styles.handle} ${styles[handle]}`}
                  onPointerDown={(event) => grab(event, handle)}
                />
              ))}
            </div>
          </div>
        </div>

        <MonoLabel size={9} tracking="0.06em" tone="faint" block>
          Оригинал остаётся: кадр всегда можно переснять
        </MonoLabel>

        {error ? (
          <MonoLabel size={9} tracking="0.06em" tone="accent" block>
            {error}
          </MonoLabel>
        ) : null}

        <div className={styles.buttons}>
          <button type="button" className={styles.button} onClick={onClose} disabled={pending}>
            ОТМЕНА
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => setRect(clampCrop(FULL_CROP))}
            disabled={pending}
          >
            ВЕСЬ КАДР
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            onClick={save}
            disabled={pending || !ready}
          >
            {pending ? 'РЕЖЕМ…' : 'КАДРИРОВАТЬ'}
          </button>
        </div>
      </div>
    </div>
  );
}
