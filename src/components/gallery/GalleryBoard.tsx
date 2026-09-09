'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { DropZone, Lightbox, MonoLabel } from '@/components/primitives';
import { uploadImages } from '@/lib/actions/images';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { numericDate } from '@/lib/dates';
import { plural } from '@/lib/plural';
import type { GalleryGroup, GalleryImage } from '@/lib/queries/gallery';
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

function Tile({ image, onOpen }: { image: GalleryImage; onOpen: () => void }) {
  const className = [styles.tile, image.isKey ? styles.key : undefined].filter(Boolean).join(' ');

  return (
    <button type="button" className={className} onClick={onOpen}>
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
          <span className={styles.overlayTitle}>{image.caption}</span>
          <MonoLabel size={9} tracking="0.08em" tone="onAccentDim">
            {meta(image)}
          </MonoLabel>
        </span>
      ) : (
        <MonoLabel size={9} tracking="0.06em" tone="faint" className={styles.caption}>
          {image.caption}
        </MonoLabel>
      )}
    </button>
  );
}

export function GalleryBoard({
  groups,
  sessionLabel,
  grouped,
}: {
  groups: GalleryGroup[];
  sessionLabel: string;
  grouped: boolean;
}) {
  const router = useRouter();
  const { canWrite } = useQuickEntry();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ group: number; index: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const depth = useRef(0);

  const flat = groups.flatMap((group) => group.images);

  const upload = useCallback(
    (files: FileList) => {
      const form = new FormData();
      for (const file of Array.from(files)) form.append('files', file);

      startTransition(async () => {
        const result = await uploadImages(form);
        if (!result.ok) setError(result.error);
        else {
          setError(null);
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
                onOpen={() => setLightbox({ group: groupIndex, index })}
              />
            ))}
          </div>
        </section>
      ))}

      {canWrite ? (
        <div className={styles.drop}>
          <DropZone
            active={dragging}
            label={pending ? 'Загружаем…' : `Бросьте файлы сюда · группа «${sessionLabel}»`}
          />
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
