'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ImagePlaceholder, MonoLabel } from '@/components/primitives';
import { ConfirmDialog } from '@/components/editor/ConfirmDialog';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { deletePortrait, uploadPortrait } from '@/lib/actions/characters';
import styles from './Character.module.css';

export function PortraitEditor({
  nodeId,
  name,
  portrait,
}: {
  nodeId: string;
  name: string;
  portrait: string | null;
}) {
  const router = useRouter();
  const { canWrite } = useQuickEntry();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    setError(null);
    const form = new FormData();
    form.append('nodeId', nodeId);
    form.append('file', file);
    startTransition(async () => {
      const result = await uploadPortrait(form);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className={styles.portraitBox}>
      {portrait ? (
        <Image
          src={portrait}
          alt={`Портрет: ${name}`}
          width={190}
          height={240}
          className={styles.portraitImage}
        />
      ) : (
        <ImagePlaceholder
          caption="Портрет 190×240"
          align="bottom"
          className={styles.portrait}
          hatchStep={8}
        />
      )}

      {canWrite ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) upload(file);
            }}
          />
          <div
            className={styles.portraitActions}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) upload(file);
            }}
          >
            <button
              type="button"
              className={styles.smallAction}
              disabled={pending}
              onClick={() => fileRef.current?.click()}
            >
              {portrait ? 'Заменить' : 'Загрузить'}
            </button>
            {portrait ? (
              <button
                type="button"
                className={styles.smallAction}
                disabled={pending}
                onClick={() => setConfirming(true)}
              >
                Убрать
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {error ? (
        <MonoLabel size={9} tracking="0.06em" tone="accent" block>
          {error}
        </MonoLabel>
      ) : null}

      {confirming ? (
        <ConfirmDialog
          title="Убрать портрет?"
          body="Файл будет удалён из хранилища. Сам персонаж и его записи останутся."
          quoted={name}
          confirmLabel="УБРАТЬ"
          pending={pending}
          onConfirm={() =>
            startTransition(async () => {
              await deletePortrait(nodeId);
              setConfirming(false);
              router.refresh();
            })
          }
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </div>
  );
}
