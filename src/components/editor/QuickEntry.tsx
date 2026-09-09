'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DropZone, MonoLabel } from '@/components/primitives';
import { WikiTextarea } from './WikiTextarea';
import { ConfirmDialog } from './ConfirmDialog';
import {
  createDraftNode,
  createEntry,
  deleteEntry,
  resolveMention,
  updateEntry,
} from '@/lib/actions/entries';
import type { EntryKind, Visibility } from '@/lib/db/schema';
import type { PickerNode } from '@/lib/queries/nodes';
import styles from './QuickEntry.module.css';

const TYPES: { id: EntryKind; label: string; lands: string }[] = [
  { id: 'moment', label: 'МОМЕНТ', lands: 'Попадёт в ленту «Хроники»' },
  { id: 'quote', label: 'ЦИТАТА', lands: 'Попадёт в ленту и в цитатник' },
  { id: 'image', label: 'ФОТО', lands: 'Попадёт в галерею; файлы бросают на «Галерею»' },
  { id: 'note', label: 'ЗАМЕТКА', lands: 'Попадёт в базу знаний' },
];

/** Запись, открытая на правку. Данные берём из карточки — лишний запрос
 *  ради полей, которые уже отрисованы, не нужен. */
export type EditableEntry = {
  id: string;
  kind: EntryKind;
  title: string | null;
  body: string | null;
  subjectId: string | null;
  visibility: Visibility;
  caption?: string | null;
};

export function QuickEntry({
  nodes,
  characters,
  sessionShort,
  isDm,
  entry,
  onClose,
}: {
  nodes: PickerNode[];
  characters: PickerNode[];
  /** «С26» — короткая метка активной сессии. */
  sessionShort: string;
  /** Мастеру доступна пометка «скрыть от игроков». */
  isDm: boolean;
  /** Задана — шит открыт на правку, а не на создание. */
  entry?: EditableEntry | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const editing = entry ?? null;

  const [kind, setKind] = useState<EntryKind>(editing?.kind ?? 'moment');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [caption, setCaption] = useState(editing?.caption ?? '');
  const [subjectId, setSubjectId] = useState(editing?.subjectId ?? characters[0]?.id ?? '');
  const [dmOnly, setDmOnly] = useState(editing?.visibility === 'dm_only');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isDraft = editing?.visibility === 'draft';
  const [error, setError] = useState<string | null>(null);
  /* Имена из [[скобок]], которым не нашлось сущности. Пока они висят,
   * шит не закрывается: иначе ребро графа не появится никогда. */
  const [unresolved, setUnresolved] = useState<{ entryId: string; names: string[] } | null>(null);
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
      const payload = {
        title: kind === 'moment' ? title : undefined,
        body,
        caption: kind === 'image' ? caption : undefined,
        subjectId: kind === 'quote' ? subjectId || undefined : undefined,
        publish,
        dmOnly,
      };

      const result = editing
        ? await updateEntry(editing.id, payload)
        : await createEntry({ kind, ...payload });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.refresh();

      if (result.unresolved.length > 0) {
        setUnresolved({ entryId: result.entryId, names: result.unresolved });
        return;
      }
      onClose();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      if (!editing) return;
      const result = await deleteEntry(editing.id);
      if (!result.ok) {
        setError(result.error);
        setConfirmingDelete(false);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function resolve(name: string) {
    if (!unresolved) return;
    setError(null);
    startTransition(async () => {
      const result = await resolveMention(unresolved.entryId, name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      if (result.unresolved.length === 0) {
        onClose();
        return;
      }
      setUnresolved({ ...unresolved, names: result.unresolved });
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
          <span className={styles.title}>{editing ? 'Правка записи' : 'Быстрая запись'}</span>
          <span className={styles.session}>{`${sessionShort} · ${openedAt}`}</span>
        </div>

        {unresolved ? (
          <div className={styles.body}>
            <MonoLabel size={10} tracking="0.14em" block>
              Запись сохранена
            </MonoLabel>
            <p className={styles.resolveNote}>
              Для этих имён нет сущности, поэтому связи в графе не появились. Заведите их — или
              оставьте, ссылки останутся простым текстом.
            </p>

            <div className={styles.resolveList}>
              {unresolved.names.map((name) => (
                <div key={name} className={styles.resolveRow}>
                  <span>{name}</span>
                  <button
                    type="button"
                    className={styles.resolveButton}
                    disabled={pending}
                    onClick={() => resolve(name)}
                  >
                    СОЗДАТЬ
                  </button>
                </div>
              ))}
            </div>

            {error ? (
              <MonoLabel size={10} tracking="0.06em" className={styles.error} block>
                {error}
              </MonoLabel>
            ) : null}

            <div className={styles.buttons}>
              <button type="button" className={styles.button} onClick={onClose}>
                ОСТАВИТЬ ТЕКСТОМ
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.body}>
            <div className={styles.types}>
              {TYPES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={
                    option.id === kind ? `${styles.type} ${styles.typeActive}` : styles.type
                  }
                  /* Тип записи при правке не меняем: он определяет и набор
                   * полей, и то, где запись живёт. */
                  disabled={Boolean(editing)}
                  title={editing ? 'Тип записи менять нельзя' : undefined}
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
              {editing ? (
                <>
                  <button
                    type="button"
                    className={styles.button}
                    disabled={pending}
                    onClick={() => setConfirmingDelete(true)}
                  >
                    УДАЛИТЬ
                  </button>
                  {/* Черновик можно и сохранить черновиком, и опубликовать. */}
                  <button
                    type="button"
                    className={isDraft ? styles.button : `${styles.button} ${styles.primary}`}
                    disabled={pending}
                    onClick={() => submit(!isDraft)}
                  >
                    СОХРАНИТЬ
                  </button>
                  {isDraft ? (
                    <button
                      type="button"
                      className={`${styles.button} ${styles.primary}`}
                      disabled={pending}
                      onClick={() => submit(true)}
                    >
                      В ХРОНИКУ
                    </button>
                  ) : null}
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {confirmingDelete && editing ? (
        <ConfirmDialog
          title="Удалить запись?"
          body="Вместе с ней исчезнут её связи в графе и голоса. Изображения останутся в галерее."
          quoted={editing.title ?? editing.body ?? editing.caption ?? null}
          confirmLabel="УДАЛИТЬ"
          pending={pending}
          onConfirm={remove}
          onCancel={() => setConfirmingDelete(false)}
        />
      ) : null}
    </div>
  );
}
