'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/editor/ConfirmDialog';
import { deleteLink } from '@/lib/actions/board';
import styles from './RemoveLinkButton.module.css';

/** Что пропадёт вместе со связью. Та же фраза в окне типа связи на доске. */
export const REMOVE_LINK_BODY =
  'Исчезнет только эта связь между двумя сущностями. Сами сущности и записи останутся.';

/**
 * Крестик у ручной связи: на карточке сущности, странице персонажа и в
 * панели узла на доске. Одно окно подтверждения на все места, чтобы связь
 * везде убиралась одинаково. Рёбра-упоминания сюда не попадают: их выводит
 * текст записи.
 */
export function RemoveLinkButton({
  linkId,
  name,
  label,
}: {
  linkId: string;
  /** Сущность на другом конце связи. */
  name: string;
  label: string | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        className={styles.remove}
        title="Убрать связь"
        aria-label={`Убрать связь с «${name}»`}
        onClick={() => setConfirming(true)}
      >
        ×
      </button>

      {confirming ? (
        <ConfirmDialog
          title="Убрать связь?"
          body={REMOVE_LINK_BODY}
          quoted={`${name}${label ? ` · ${label}` : ''}`}
          confirmLabel="УБРАТЬ"
          pending={pending}
          onConfirm={() =>
            startTransition(async () => {
              await deleteLink(linkId);
              setConfirming(false);
              router.refresh();
            })
          }
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </>
  );
}
