'use client';

/* Блок «Достижения» внизу страницы персонажа: одна галерея, куда участники
 * складывают картинки достижений. Перетаскивание ловим на самом блоке, а не
 * на окне (как на «Галерее»): страница персонажа — не про загрузку файлов,
 * и лишний оверлей на весь экран здесь мешал бы. */

import { useCallback, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { DropZone, Lightbox, MonoLabel } from '@/components/primitives';
import { ConfirmDialog } from '@/components/editor/ConfirmDialog';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { deleteAchievement, uploadAchievements } from '@/lib/actions/achievements';
import { plural } from '@/lib/plural';
import styles from './Character.module.css';

export type Achievement = {
  id: string;
  url: string | null;
  caption: string | null;
  uploaderName: string | null;
  /** Своё достижение убирает автор загрузки, любое — мастер. */
  canRemove: boolean;
};

export function Achievements({
  nodeId,
  name,
  achievements,
}: {
  nodeId: string;
  name: string;
  achievements: Achievement[];
}) {
  const router = useRouter();
  const { canWrite } = useQuickEntry();
  const fileRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<number | null>(null);
  const [removing, setRemoving] = useState<Achievement | null>(null);
  const [pending, startTransition] = useTransition();

  const upload = useCallback(
    (files: FileList | File[]) => {
      const form = new FormData();
      form.append('nodeId', nodeId);
      for (const file of Array.from(files)) form.append('files', file);

      startTransition(async () => {
        const result = await uploadAchievements(form);
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
        current === null || achievements.length === 0
          ? current
          : (current + delta + achievements.length) % achievements.length,
      ),
    [achievements.length],
  );

  const current = opened === null ? null : (achievements[opened] ?? null);

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
    <section className={styles.achievements} {...dropHandlers}>
      <div className={styles.achievementsHead}>
        <h2 className={styles.sectionTitle}>Достижения</h2>
        <span className={styles.rule} />
        <MonoLabel size={10} tracking="0.1em">
          {`${achievements.length} ${plural(achievements.length, 'достижение', 'достижения', 'достижений')}`}
        </MonoLabel>
      </div>

      {achievements.length > 0 ? (
        <div className={styles.achievementsGrid}>
          {achievements.map((achievement, index) => (
            <div key={achievement.id} className={styles.achievement}>
              <button
                type="button"
                className={styles.achievementTile}
                aria-label={`Открыть: ${achievement.caption ?? 'достижение'}`}
                onClick={() => setOpened(index)}
              >
                {achievement.url ? (
                  <Image
                    src={achievement.url}
                    alt={achievement.caption ?? 'Достижение'}
                    fill
                    className={styles.achievementPhoto}
                    sizes="(max-width: 767px) 50vw, (max-width: 1023px) 25vw, 16vw"
                  />
                ) : null}
              </button>

              {canWrite && achievement.canRemove ? (
                <button
                  type="button"
                  className={styles.achievementRemove}
                  aria-label="Убрать достижение"
                  disabled={pending}
                  onClick={() => setRemoving(achievement)}
                >
                  ×
                </button>
              ) : null}

              <MonoLabel size={9} tracking="0.06em" tone="faint" block>
                {achievement.caption ?? 'Без подписи'}
              </MonoLabel>
            </div>
          ))}
        </div>
      ) : (
        <MonoLabel size={10} tracking="0.08em" tone="faint" block>
          {canWrite ? 'Достижений пока нет — перетащите картинки сюда' : 'Достижений пока нет'}
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
            className={styles.achievementsDrop}
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
          alt={`Достижение: ${current.caption ?? name}`}
          /* Имя загрузившего повторять незачем, если оно и есть имя персонажа. */
          meta={[name, current.uploaderName === name ? null : current.uploaderName]
            .filter(Boolean)
            .join(' · ')}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onClose={() => setOpened(null)}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Убрать достижение?"
          body="Картинка будет удалена из хранилища. Остальные достижения останутся."
          quoted={removing.caption}
          confirmLabel="УБРАТЬ"
          pending={pending}
          onConfirm={() =>
            startTransition(async () => {
              const result = await deleteAchievement(removing.id);
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
    </section>
  );
}
