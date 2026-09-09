'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DropZone, MonoLabel } from '@/components/primitives';
import { WikiTextarea } from './WikiTextarea';
import { createDraftNode, createEntry } from '@/lib/actions/entries';
import type { EntryKind } from '@/lib/db/schema';
import type { PickerNode } from '@/lib/queries/nodes';
import styles from './QuickEntry.module.css';

const TYPES: { id: EntryKind; label: string; lands: string }[] = [
  { id: 'moment', label: 'МОМЕНТ', lands: 'Попадёт в ленту «Хроники»' },
  { id: 'quote', label: 'ЦИТАТА', lands: 'Попадёт в ленту и в цитатник' },
  { id: 'image', label: 'ФОТО', lands: 'Попадёт в галерею; загрузка файлов — позже' },
  { id: 'note', label: 'ЗАМЕТКА', lands: 'Попадёт в базу знаний' },
];

export function QuickEntry({
  nodes,
  characters,
  sessionShort,
  isDm,
  onClose,
}: {
  nodes: PickerNode[];
  characters: PickerNode[];
  /** «С26» — короткая метка активной сессии. */
  sessionShort: string;
  /** Мастеру доступна пометка «скрыть от игроков». */
  isDm: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<EntryKind>('moment');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [caption, setCaption] = useState('');
  const [subjectId, setSubjectId] = useState(characters[0]?.id ?? '');
  const [dmOnly, setDmOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sheetRef = useRef<HTMLDivElement>(null);

  /* Шит монтируется только по действию пользователя, поэтому время можно
   * взять на клиенте — расхождения с сервером не будет. */
  const [openedAt] = useState(() =>
    new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const type = TYPES.find((t) => t.id === kind) ?? TYPES[0];

  function submit(publish: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await createEntry({
        kind,
        title: kind === 'moment' ? title : undefined,
        body,
        caption: kind === 'image' ? caption : undefined,
        subjectId: kind === 'quote' ? subjectId || undefined : undefined,
        publish,
        dmOnly,
      });

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
      onMouseDown={(e) => {
        if (!sheetRef.current?.contains(e.target as Node)) onClose();
      }}
    >
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="Быстрая запись"
      >
        <div className={styles.head}>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
            ×
          </button>
          <span className={styles.title}>Быстрая запись</span>
          <span className={styles.session}>{`${sessionShort} · ${openedAt}`}</span>
        </div>

        <div className={styles.body}>
          <div className={styles.types}>
            {TYPES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={option.id === kind ? `${styles.type} ${styles.typeActive}` : styles.type}
                onClick={() => {
                  setKind(option.id);
                  setError(null);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          <MonoLabel size={9} tracking="0.08em" tone="faint" block>
            {type.lands}
          </MonoLabel>

          {kind === 'moment' ? (
            <input
              className={styles.titleField}
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              placeholder="Заголовок момента…"
            />
          ) : null}

          {kind === 'quote' ? (
            <select
              className={styles.select}
              value={subjectId}
              onChange={(e) => setSubjectId(e.currentTarget.value)}
              aria-label="Автор цитаты"
            >
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
          ) : null}

          {kind === 'image' ? (
            <>
              {/* Приём файлов появится на этапе 6 — пока подпись к будущему кадру. */}
              <DropZone label="Загрузка файлов — этап 6" />
              <input
                className={styles.caption}
                value={caption}
                onChange={(e) => setCaption(e.currentTarget.value)}
                placeholder="Подпись к кадру…"
              />
            </>
          ) : (
            <WikiTextarea
              value={body}
              onChange={setBody}
              nodes={nodes}
              onCreateNode={createDraftNode}
              placeholder={
                kind === 'quote' ? 'Текст цитаты…' : 'Что произошло? Ссылки — в [[скобках]]'
              }
            />
          )}

          {isDm ? (
            <label className={styles.dmOnly}>
              <input
                type="checkbox"
                checked={dmOnly}
                onChange={(e) => setDmOnly(e.currentTarget.checked)}
              />
              <MonoLabel size={9} tracking="0.08em" tone="faint">
                Скрыть от игроков
              </MonoLabel>
            </label>
          ) : null}

          {error ? (
            <MonoLabel size={10} tracking="0.06em" className={styles.error} block>
              {error}
            </MonoLabel>
          ) : null}

          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.button}
              disabled={pending}
              onClick={() => submit(false)}
            >
              ЧЕРНОВИК
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.primary}`}
              disabled={pending}
              onClick={() => submit(true)}
            >
              В ХРОНИКУ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
