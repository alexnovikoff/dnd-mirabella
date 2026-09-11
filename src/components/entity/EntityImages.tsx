'use client';

/* Изображения карточки сущности: портрет NPC, вид локации, герб фракции.
 *
 * Устроено как «Достижения» персонажа — та же плитка, тот же лайтбокс,
 * то же перетаскивание на сам блок, а не на окно: карточка не про загрузку
 * файлов, и оверлей во весь экран здесь мешал бы. Подпись берётся из имени
 * файла и дальше живёт в базе: править её отсюда пока нечем.
 */

import { useCallback, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { DropZone, Lightbox, MonoLabel } from '@/components/primitives';
import { ConfirmDialog } from '@/components/editor/ConfirmDialog';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { deleteEntityImage, uploadEntityImages } from '@/lib/actions/entity-images';
import styles from './EntityImages.module.css';

export type EntityImage = {
  id: string;
  url: string | null;
  caption: string | null;
  uploaderName: string | null;
};

export function EntityImages({
  nodeId,
  name,
  images,
}: {
  nodeId: string;
  name: string;
  images: EntityImage[];
}) {
  const router = useRouter();
  const { canWrite } = useQuickEntry();
  const fileRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<number | null>(null);
  const [removing, setRemoving] = useState<EntityImage | null>(null);
  const [pending, startTransition] = useTransition();

  const upload = useCallback(
    (files: FileList | File[]) => {
      const form = new FormData();
      form.append('nodeId', nodeId);
      for (const file of Array.from(files)) form.append('files', file);

      startTransition(async () => {
        const result = await uploadEntityImages(form);
        if (!result.ok) setError(result.error);
        else {
          setError(null);
          router.refresh();
        }
      });
    },
    [nodeId, router],
  );

  const step = useCallback(
    (delta: number) =>
      setOpened((current) =>
        current === null || images.length === 0
          ? current
          : (current + delta + images.length) % images.length,
      ),
    [images.length],
  );

  const current = opened === null ? null : (images[opened] ?? null);

  const dropHandlers = canWrite
    ? {
        onDragEnter: (event: React.DragEvent) => {
          if (!event.dataTransfer.types.includes('Files')) return;
          depth.current += 1;
          setDragging(true);
        },
        onDragOver: (event: React.DragEvent) => {
          if (event.dataTransfer.types.includes('Files')) event.preventDefault();
        },
        onDragLeave: () => {
          depth.current = Math.max(0, depth.current - 1);
          if (depth.current === 0) setDragging(false);
        },
        onDrop: (event: React.DragEvent) => {
          if (!event.dataTransfer.files.length) return;
          event.preventDefault();
          depth.current = 0;
          setDragging(false);
          upload(event.dataTransfer.files);
        },
      }
    : {};

  return (
    <div className={styles.images} {...dropHandlers}>
      {images.length > 0 ? (
        <div className={styles.grid}>
          {images.map((image, index) => (
            <div key={image.id} className={styles.item}>
              <button
                type="button"
                className={styles.tile}
                aria-label={`Открыть: ${image.caption ?? 'изображение'}`}
                onClick={() => setOpened(index)}
              >
                {image.url ? (
                  <Image
                    src={image.url}
                    alt={image.caption ?? name}
                    fill
                    className={styles.photo}
                    sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw"
                  />
                ) : null}
              </button>

              {canWrite ? (
                <button
                  type="button"
                  className={styles.remove}
                  aria-label="Убрать изображение"
                  disabled={pending}
                  onClick={() => setRemoving(image)}
                >
                  ×
                </button>
              ) : null}

              <MonoLabel size={9} tracking="0.06em" tone="faint" block>
                {image.caption ?? 'Без подписи'}
              </MonoLabel>
            </div>
          ))}
        </div>
      ) : (
        <MonoLabel size={9} tracking="0.08em" tone="faint" block>
          {canWrite ? 'Изображений пока нет — перетащите картинки сюда' : 'Изображений пока нет'}
        </MonoLabel>
      )}

      {canWrite ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              const files = event.currentTarget.files;
              if (files?.length) upload(files);
              /* Один и тот же файл должен грузиться дважды подряд. */
              event.currentTarget.value = '';
            }}
          />
          <button
            type="button"
            className={styles.drop}
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          >
            <DropZone
              active={dragging}
              label={pending ? 'Загружаем…' : 'Бросьте картинки сюда или нажмите'}
            />
          </button>
        </>
      ) : null}

      {error ? (
        <MonoLabel size={10} tracking="0.06em" tone="accent" block>
          {error}
        </MonoLabel>
      ) : null}

      {current ? (
        <Lightbox
          url={current.url}
          caption={current.caption}
          alt={`${name}: ${current.caption ?? 'изображение'}`}
          meta={[name, current.uploaderName].filter(Boolean).join(' · ')}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onClose={() => setOpened(null)}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Убрать изображение?"
          body="Картинка будет удалена из хранилища. Остальные изображения карточки останутся."
          quoted={removing.caption}
          confirmLabel="УБРАТЬ"
          pending={pending}
          onConfirm={() =>
            startTransition(async () => {
              const result = await deleteEntityImage(removing.id);
              setRemoving(null);
              if (!result.ok) setError(result.error);
              else {
                setError(null);
                router.refresh();
              }
            })
          }
          onCancel={() => setRemoving(null)}
        />
      ) : null}
    </div>
  );
}
