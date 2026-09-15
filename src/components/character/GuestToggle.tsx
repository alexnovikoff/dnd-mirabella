'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MonoLabel } from '@/components/primitives';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { setCharacterGuest } from '@/lib/actions/characters';
import chips from '@/components/primitives/FilterChips.module.css';

/**
 * Тумблер «Гостевой персонаж» на карточке сущности. На странице персонажа
 * тот же признак — флажок в форме «Править» (`CharacterEditor`).
 *
 * Выглядит как тумблер «Группировать по сессиям» в галерее: включённый залит
 * акцентом и несёт квадрат слева. Включён — персонаж гостевой: из «Партии»,
 * hero «Хроники» и авторов цитат он уходит. Разлогиненному переключать нечем,
 * ему остаётся подпись — и то только у гостя: у основного персонажа отмечать
 * нечего.
 */
export function GuestToggle({ nodeId, guest }: { nodeId: string; guest: boolean }) {
  const router = useRouter();
  const { canWrite } = useQuickEntry();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canWrite) {
    return guest ? (
      <MonoLabel size={10} tracking="0.08em" tone="faint">
        Гостевой персонаж
      </MonoLabel>
    ) : null;
  }

  return (
    <div className={`${chips.row} ${chips.md}`}>
      <button
        type="button"
        className={guest ? `${chips.chip} ${chips.toggleOn}` : chips.chip}
        aria-pressed={guest}
        disabled={pending}
        title={
          guest
            ? 'Сделать основным: появится в «Партии», на «Хронике» и среди авторов цитат'
            : 'Сделать гостевым: уйдёт из «Партии», с «Хроники» и из авторов цитат'
        }
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await setCharacterGuest(nodeId, !guest);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.refresh();
          })
        }
      >
        {guest ? <span className={chips.marker} aria-hidden="true" /> : null}
        ГОСТЕВОЙ ПЕРСОНАЖ
      </button>
      {error ? (
        <MonoLabel size={10} tracking="0.06em" tone="accent">
          {error}
        </MonoLabel>
      ) : null}
    </div>
  );
}
