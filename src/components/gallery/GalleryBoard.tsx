'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { DropZone, Lightbox, MonoLabel } from '@/components/primitives';
import { ConfirmDialog } from '@/components/editor/ConfirmDialog';
import { deleteImage, uploadImages } from '@/lib/actions/images';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { numericDate } from '@/lib/dates';
import { plural } from '@/lib/plural';
import type { GalleryGroup, GalleryImage } from '@/lib/queries/gallery';
import { NO_SESSION } from '@/lib/sessions-shared';
import styles from './Gallery.module.css';

const KIND_LABEL: Record<GalleryImage['kind'], string> = {
  art: 'АРТ',
  map: 'КАРТА',
  screenshot: 'СКРИН',
};

/* В макете подпись звучит как «ЗАГРУЗИЛА МЕТЕЛЬ», но род глагола требует
 * знать пол игрока, а такого поля нет и выдумывать его не стоит. Оставляем
 * нейтральное перечисление — оно читается так же. */
function meta(image: GalleryImage): string {
  return [
    KIND_LABEL[image.kind],
    image.sessionNumber ? `С${image.sessionNumber}` : null,
    image.uploaderName,
  ]
    .filter(Boolean)
    .join(' · ');
}

function Tile({
  image,
  canRemove,
  onOpen,
  onRemove,
}: {
  image: GalleryImage;
  /** Крестик показываем только вошедшим — галерею собирают вместе. */
  canRemove: boolean;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const className = [styles.tile, image.isKey ? styles.key : undefined].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <button type="button" className={styles.frame} onClick={onOpen}>
        {image.url ? (
          <Image
            src={image.url}
            alt={image.caption ?? ''}
            fill
            className={styles.photo}
            sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw"
          />
        ) : null}

        {image.isKey ? (
          <span className={styles.overlay}>
            {/* Кадр без подписи оставляет плашке только мету — пустой строки
                над ней быть не должно. */}
            {image.caption ? <span className={styles.overlayTitle}>{image.caption}</span> : null}
            <MonoLabel size={9} tracking="0.08em" tone="onAccentDim">
              {meta(image)}
            </MonoLabel>
          </span>
        ) : null}
      </button>

      {/* Подпись обычного кадра лежит под изображением: поверх фотографии её
          было почти не разобрать. У ключевого кадра она остаётся плашкой —
          там под ней тёмная подложка. */}
      {!image.isKey && image.caption ? (
        <span className={styles.caption}>{image.caption}</span>
      ) : null}

      {canRemove ? (
        <button
          type="button"
          className={styles.remove}
          title="Убрать кадр"
          aria-label={`Убрать кадр${image.caption ? `: ${image.caption}` : ''}`}
          onClick={onRemove}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export function GalleryBoard({
  groups,
  sessionLabel,
  grouped,
}: {
  groups: GalleryGroup[];
  /** Активная сессия — куда файлы уходят по умолчанию. null — сессий нет
   *  вовсе, тогда и выбирать не из чего. */
  sessionLabel: string | null;
  grouped: boolean;
}) {
  const router = useRouter();
  const { canWrite, open } = useQuickEntry();
  const [dragging, setDragging] = useState(false);
  /* Куда лягут брошенные файлы. Не всякий кадр относится к вечеру за столом:
   * арты и карты мира живут в галерее сами по себе. */
  const [toSession, setToSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ group: number; index: number } | null>(null);
  const [removing, setRemoving] = useState<GalleryImage | null>(null);
  const [pending, startTransition] = useTransition();
  const depth = useRef(0);

  const flat = groups.flatMap((group) => group.images);

  const upload = useCallback(
    (files: FileList) => {
      const form = new FormData();
      for (const file of Array.from(files)) form.append('files', file);
      /* Пустое значение означало бы «на усмотрение сервера» — то есть
       * активную сессию; вне сессий кадр кладут только явным NO_SESSION. */
      if (!toSession) form.append('sessionId', NO_SESSION);

      startTransition(async () => {
        const result = await uploadImages(form);
        if (!result.ok) setError(result.error);
        else {
          setError(null);
          router.refresh();
        }
      });
    },
    [router, toSession],
  );

  const remove = useCallback(
    (image: GalleryImage) => {
      startTransition(async () => {
        const result = await deleteImage(image.id);
        setRemoving(null);
        if (!result.ok) setError(result.error);
        else {
          setError(null);
          /* Кадр мог быть открыт в лайтбоксе — оттуда ему тоже пора. */
          setLightbox(null);
          router.refresh();
        }
      });
    },
    [router],
  );

  /* Перетаскивание ловим на всей странице — README «Галерея». */
  useEffect(() => {
    if (!canWrite) return;

    function onDragEnter(event: DragEvent) {
      if (!event.dataTransfer?.types.includes('Files')) return;
      depth.current += 1;
      setDragging(true);
    }
    function onDragOver(event: DragEvent) {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
    }
    function onDragLeave() {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    }
    function onDrop(event: DragEvent) {
      if (!event.dataTransfer?.files.length) return;
      event.preventDefault();
      depth.current = 0;
      setDragging(false);
      upload(event.dataTransfer.files);
    }

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [upload, canWrite]);

  const current = lightbox ? groups[lightbox.group]?.images[lightbox.index] : null;

  return (
    <div className={dragging ? `${styles.page} ${styles.dragging}` : styles.page}>
      {groups.map((group, groupIndex) => (
        <section key={group.key} className={styles.page}>
          {grouped ? (
            <div className={styles.groupHead}>
              <h2 className={styles.groupTitle}>{group.title}</h2>
              <span className={styles.rule} />
              <MonoLabel size={10} tracking="0.1em">
                {`${group.images.length} ${plural(group.images.length, 'изображение', 'изображения', 'изображений')} · ${numericDate(group.date)}`}
              </MonoLabel>
            </div>
          ) : null}

          <div className={styles.grid}>
            {group.images.map((image, index) => (
              <Tile
                key={image.id}
                image={image}
                canRemove={canWrite}
                onOpen={() => setLightbox({ group: groupIndex, index })}
                onRemove={() => setRemoving(image)}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Полоса работает и на бросок файлов, и на клик: клик открывает ту же
          быструю запись с типом «ФОТО», что и кнопка «+ ФОТО» в шапке.
          Переключатель группы стоит над ней отдельно — кнопке внутри кнопки
          в разметке места нет. */}
      {canWrite ? (
        <div className={styles.dropBlock}>
          {sessionLabel ? (
            <div className={styles.target} role="group" aria-label="Куда положить кадры">
              <MonoLabel size={9} tracking="0.08em" tone="faint">
                Группа
              </MonoLabel>
              <button
                type="button"
                className={toSession ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                aria-pressed={toSession}
                onClick={() => setToSession(true)}
              >
                {sessionLabel.toUpperCase()}
              </button>
              <button
                type="button"
                className={!toSession ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                aria-pressed={!toSession}
                onClick={() => setToSession(false)}
              >
                БЕЗ СЕССИИ
              </button>
            </div>
          ) : null}

          <button
            type="button"
            className={styles.drop}
            title="Открыть быструю запись с типом «ФОТО»"
            onClick={() => open('image', toSession ? undefined : NO_SESSION)}
          >
            <DropZone
              active={dragging}
              label={
                pending
                  ? 'Загружаем…'
                  : `Бросьте файлы сюда или нажмите · группа «${sessionLabel && toSession ? sessionLabel : 'Без сессии'}»`
              }
            />
          </button>
        </div>
      ) : null}

      {error ? (
        <MonoLabel size={10} tracking="0.06em" tone="accent" block>
          {error}
        </MonoLabel>
      ) : null}

      {flat.length === 0 ? (
        <MonoLabel size={10} tracking="0.08em" tone="faint" block>
          Пока ни одного изображения — перетащите файлы на страницу
        </MonoLabel>
      ) : null}

      {current ? (
        <Lightbox
          url={current.url}
          caption={current.caption}
          meta={meta(current)}
          onPrev={() => setLightbox((s) => step(s, groups, -1))}
          onNext={() => setLightbox((s) => step(s, groups, 1))}
          onClose={() => setLightbox(null)}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Убрать кадр?"
          body="Кадр исчезнет из галереи и из сессии, файл будет удалён. Если его заводили быстрой записью, вместе с ним уйдёт и сама запись."
          quoted={removing.caption}
          confirmLabel="УБРАТЬ"
          pending={pending}
          onConfirm={() => remove(removing)}
          onCancel={() => setRemoving(null)}
        />
      ) : null}
    </div>
  );
}

/** Листание внутри группы по кругу. */
function step(
  state: { group: number; index: number } | null,
  groups: GalleryGroup[],
  delta: number,
) {
  if (!state) return state;
  const images = groups[state.group]?.images ?? [];
  if (images.length === 0) return state;
  const next = (state.index + delta + images.length) % images.length;
  return { group: state.group, index: next };
}
