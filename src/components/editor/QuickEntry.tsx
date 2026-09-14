'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DropZone, MonoLabel } from '@/components/primitives';
import { createPhotoEntry } from '@/lib/actions/images';
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
import type { SessionOption } from '@/lib/queries/sessions';
import { NO_SESSION } from '@/lib/sessions-shared';
import { shortRuDate } from '@/lib/dates';
import { plural } from '@/lib/plural';
import { describeFailures, uploadEach } from '@/lib/uploads';
import styles from './QuickEntry.module.css';

const TYPES: { id: EntryKind; label: string; lands: string }[] = [
  { id: 'moment', label: 'МОМЕНТ', lands: 'Попадёт в ленту «Хроники»' },
  { id: 'quote', label: 'ЦИТАТА', lands: 'Попадёт в ленту и в цитатник' },
  { id: 'image', label: 'ФОТО', lands: 'Попадёт в галерею выбранной сессии' },
  { id: 'note', label: 'ЗАМЕТКА', lands: 'Попадёт в базу знаний' },
];

/** «Сессия 26 · Ночь в порту · 6 сент» — строка выпадающего списка сессий. */
function sessionLabel(session: SessionOption): string {
  return [`Сессия ${session.number}`, session.title, shortRuDate(session.date)]
    .filter(Boolean)
    .join(' · ');
}

/** Строка в поле кадра: что выбрано. Список имён целиком в полосу не влезет —
 *  первого файла хватает, чтобы узнать пачку. */
function filesLabel(files: File[]): string {
  if (files.length === 0) return 'Выберите файлы или бросьте их сюда';
  if (files.length === 1) return files[0].name;
  const count = `${files.length} ${plural(files.length, 'файл', 'файла', 'файлов')}`;
  return `${count}: ${files[0].name} и ещё ${files.length - 1}`;
}

/** Запись, открытая на правку. Данные берём из карточки — лишний запрос
 *  ради полей, которые уже отрисованы, не нужен. */
export type EditableEntry = {
  id: string;
  kind: EntryKind;
  title: string | null;
  body: string | null;
  subjectId: string | null;
  /** Сессия записи: с ней открывается селект. null — запись вне сессий. */
  sessionId: string | null;
  visibility: Visibility;
  caption?: string | null;
};

export function QuickEntry({
  nodes,
  characters,
  sessions,
  isDm,
  entry,
  defaultKind = 'moment',
  defaultSessionId = null,
  onClose,
}: {
  nodes: PickerNode[];
  characters: PickerNode[];
  /** Сессии для выбора, последняя сверху: она же стоит по умолчанию. */
  sessions: SessionOption[];
  /** Мастеру доступна пометка «скрыть от игроков». */
  isDm: boolean;
  /** Задана — шит открыт на правку, а не на создание. */
  entry?: EditableEntry | null;
  /** Тип, выбранный при открытии: кнопка экрана «Цитаты» открывает цитату. */
  defaultKind?: EntryKind;
  /** Сессия, выбранная при открытии: полоса загрузки на «Галерее» открывает
   *  шит той же группой, что показывает сама. */
  defaultSessionId?: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const editing = entry ?? null;

  const [kind, setKind] = useState<EntryKind>(editing?.kind ?? defaultKind);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [caption, setCaption] = useState(editing?.caption ?? '');
  const [subjectId, setSubjectId] = useState(editing?.subjectId ?? characters[0]?.id ?? '');
  /* При правке — сессия самой записи; при создании список отсортирован
   * по убыванию номера, поэтому первая в нём и есть активная. */
  const [sessionId, setSessionId] = useState(
    editing ? (editing.sessionId ?? NO_SESSION) : (defaultSessionId ?? sessions[0]?.id ?? ''),
  );
  const [dmOnly, setDmOnly] = useState(editing?.visibility === 'dm_only');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  /* «Загружаем 2 из 5…» — кадры пачки уходят по одному. */
  const [progress, setProgress] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
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
  /* Кадру вне сессий место всё равно найдётся — в галерее он будет лежать
   * отдельной группой «Без сессии». */
  const lands = kind === 'image' && sessionId === NO_SESSION ? 'Попадёт в галерею' : type.lands;

  function submit(publish: boolean) {
    setError(null);
    startTransition(async () => {
      const payload = {
        title: kind === 'moment' ? title : undefined,
        body,
        caption: kind === 'image' ? caption : undefined,
        subjectId: kind === 'quote' ? subjectId || undefined : undefined,
        sessionId: sessionId || undefined,
        publish,
        dmOnly,
      };

      /* Фото приходит вместе с файлом, поэтому уходит формой, а не объектом. */
      if (kind === 'image' && !editing) {
        const photo = (file?: File) => {
          const form = new FormData();
          form.append('caption', caption);
          form.append('publish', publish ? '1' : '0');
          form.append('sessionId', sessionId);
          if (file) form.append('file', file);
          return createPhotoEntry(form);
        };

        /* Без файла остаётся подпись к кадру, который принесут позже. */
        if (files.length === 0) {
          const result = await photo();
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.refresh();
          onClose();
          return;
        }

        /* Каждый файл — свой кадр и своя запись, ровно как если бы их заводили
         * по одному: в выбранную сессию и с подписью из поля. И запросами
         * они едут по одному — пачка одной формой не пролезает в предел
         * тела запроса. */
        const outcome = await uploadEach(files, photo, (current, total) =>
          setProgress(total > 1 ? `Загружаем ${current} из ${total}…` : null),
        );
        setProgress(null);
        if (outcome.saved > 0) router.refresh();
        if (outcome.failed.length > 0) {
          /* В поле остаются только не легшие кадры: повторная отправка
           * не должна удвоить те, что уже в галерее. */
          setFiles(outcome.failed.map((item) => item.file));
          setError(describeFailures(outcome.failed));
          return;
        }
        onClose();
        return;
      }

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
      /* Файлы, брошенные мимо поля, не должны ни открыться во вкладке вместо
       * страницы, ни достаться странице под шитом: «Галерея» уложила бы их
       * в группу со своей полосы, а не в сессию из шита. Текст не трогаем —
       * его перетаскивают внутри поля записи. */
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDrop={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
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
          {/* Крестик в левом верхнем углу — привычное место закрытия окна. */}
          <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
            ×
          </button>
          <span className={styles.title}>{editing ? 'Правка записи' : 'Быстрая запись'}</span>
          <span className={styles.session}>{openedAt}</span>
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
                    setFiles([]);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <MonoLabel size={9} tracking="0.08em" tone="faint" block>
              {lands}
            </MonoLabel>

            {/* Сессия записи. По умолчанию активная, но вечером после игры
                запись нередко заводят задним числом — к прошлой; и уже
                сохранённую запись из шита правки можно перенести в другую.
                Поле можно и оставить пустым — первым пунктом идёт пустой
                вариант. */}
            {sessions.length > 0 ? (
              <div className={styles.field}>
                <MonoLabel size={9} tracking="0.08em" tone="faint" block>
                  Сессия
                </MonoLabel>
                <select
                  className={styles.select}
                  value={sessionId}
                  onChange={(e) => setSessionId(e.currentTarget.value)}
                  aria-label="Сессия записи"
                >
                  {/* Пустой пункт: запись не обязана относиться к игре — арт
                      персонажа, карта мира, заметка между сессиями. Подпись у
                      него пустая (неразрывный пробел держит высоту строки:
                      совсем пустой пункт в списке не во что нажать). */}
                  <option value={NO_SESSION}>{'\u00a0'}</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {sessionLabel(session)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

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
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => setFiles(Array.from(e.currentTarget.files ?? []))}
                />
                {/* Файлы можно выбрать или бросить прямо сюда — один или пачкой;
                    без файла останется подпись к кадру, который принесут позже.
                    preventDefault на броске — знак странице под шитом, что
                    файлы уже забрали: «Галерея» проверяет его и не грузит их
                    второй раз в группу со своей полосы. */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const dropped = Array.from(e.dataTransfer.files ?? []);
                    if (dropped.length > 0) setFiles(dropped);
                  }}
                >
                  <DropZone active={dragging} label={progress ?? filesLabel(files)} />
                </div>
                <input
                  className={styles.caption}
                  value={caption}
                  onChange={(e) => setCaption(e.currentTarget.value)}
                  /* Подпись — единственная строка в форме кадра, и Enter в ней
                   * ждут как «готово»: в обычной форме он нажал бы главную
                   * кнопку. Делаем ровно это — пока прошлая отправка не
                   * закончилась, кнопки выключены, и Enter тоже молчит. */
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !pending) {
                      e.preventDefault();
                      submit(true);
                    }
                  }}
                  placeholder={
                    files.length > 1
                      ? 'Подпись ко всем кадрам (необязательно)…'
                      : 'Подпись к кадру (необязательно)…'
                  }
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
          body="Вместе с ней исчезнут её связи в графе. Изображения останутся в галерее."
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
