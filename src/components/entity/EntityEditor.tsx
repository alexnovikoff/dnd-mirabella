'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MonoLabel } from '@/components/primitives';
import { ConfirmDialog } from '@/components/editor/ConfirmDialog';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { deleteNode, updateNode } from '@/lib/actions/nodes';
import { NODE_KIND_TITLE } from '@/lib/nodes';
import type { NodeKind, NodeStatus } from '@/lib/db/schema';
import picker from '@/components/editor/Picker.module.css';
import styles from './EntityEditor.module.css';

/** Типы, между которыми переключается узел. Смена на «Персонаж» делает узел
 *  гостевым персонажем, смена с него — убирает портрет, биографию и
 *  достижения (с подтверждением). Персонажу игрока тип не меняется: у него
 *  ниже единственный вариант, и тип ему держит сервер. */
const KINDS: NodeKind[] = [
  'character',
  'npc',
  'location',
  'faction',
  'artifact',
  'event',
  'rumor',
  'unknown',
];

/* «НЕ ЗАДАН», а не «БЕЗ СТАТУСА»: список стоит в паре с типом в колонке
 * шириной 300px, и длинная подпись в него не влезала целиком. */
const STATUSES: { value: string; label: string }[] = [
  { value: '', label: 'НЕ ЗАДАН' },
  { value: 'open', label: 'ОТКРЫТА' },
  { value: 'resolved', label: 'РАСКРЫТА' },
  { value: 'dead_end', label: 'ТУПИК' },
];

export function EntityEditor({
  node,
  returnTo = 'entity',
}: {
  /** 'board' — редактор открыт в панели доски: после переименования
   *  остаёмся там же, а не уходим на страницу сущности. */
  returnTo?: 'entity' | 'board';
  node: {
    id: string;
    name: string;
    kind: NodeKind;
    status: NodeStatus | null;
    description: string | null;
    aliases: string[];
    /** Узел — персонаж, основной или гостевой: у него есть строка в characters. */
    isCharacter: boolean;
    /** К персонажу привязан игрок: тип не меняется, удалить нельзя. */
    hasPlayer: boolean;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { canWrite } = useQuickEntry();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(node.name);
  const [kind, setKind] = useState<NodeKind>(node.kind);
  const [status, setStatus] = useState<string>(node.status ?? '');
  const [description, setDescription] = useState(node.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  /* Смена типа с «Персонажа» стирает портрет и достижения — сначала спросить. */
  const [confirmingKind, setConfirmingKind] = useState(false);
  const [pending, startTransition] = useTransition();

  /* На странице сущности форма всплывает поверх карточки, как у персонажа, и
   * Esc закрывает её, как «Отмена». Клик мимо формы — нет: промах мышью стёр
   * бы набранное. Пока идёт сохранение, закрыть нельзя. Окно подтверждения
   * ловит Esc раньше и закрывается само, форма под ним остаётся. */
  useEffect(() => {
    if (!open || pending || returnTo === 'board') return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, pending, returnTo]);

  /* Без входа править нечем. Пустое место на месте кнопки читается как
   * поломка, поэтому вместо неё — строка со ссылкой на вход. На доске такая
   * же строка уже висит в тулбаре, второй раз в панели она не нужна. */
  if (!canWrite) {
    if (returnTo === 'board') return null;
    return (
      <div className={styles.bar}>
        <Link href={`/login?from=${encodeURIComponent(pathname)}`} className={styles.hint}>
          <MonoLabel size={9} tracking="0.08em" tone="accent">
            Только чтение · Войти
          </MonoLabel>
        </Link>
      </div>
    );
  }

  /* Поля сбрасываются при открытии, а не при закрытии: так «Отмена», Esc и
   * повторный клик по «Править» закрывают одинаково, а после сохранения
   * форма берёт уже обновлённые значения. */
  const openEditor = () => {
    setName(node.name);
    setKind(node.kind);
    setStatus(node.status ?? '');
    setDescription(node.description ?? '');
    setError(null);
    setOpen(true);
  };

  /* Прежних имён рядом с кнопкой нет: и на доске, и на странице сущности она
   * делит строку с подписью или заголовком, и именам там тесно. Обе страницы
   * ставят их под названием. */
  const toggle = (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.action}
        aria-expanded={open}
        disabled={pending}
        onClick={() => (open ? setOpen(false) : openEditor())}
      >
        Править
      </button>
    </div>
  );

  if (!open) return toggle;

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateNode(node.id, {
        name,
        kind,
        status: (status || null) as NodeStatus | null,
        description,
      });
      setConfirmingKind(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      /* Слаг мог смениться вместе с именем — уходим на новый адрес. */
      router.replace(
        returnTo === 'board' ? `/board?node=${result.slug}` : `/entities/${result.slug}`,
      );
      router.refresh();
    });
  };

  return (
    <>
      {/* На странице сущности кнопка остаётся на месте и при открытой форме:
          без неё строка названия на телефоне теряла высоту кнопки (44px), и
          тип со статусом поднимались. На доске форму ставит панель, и строку
          «Выбранный узел» держит она сама. */}
      {returnTo === 'entity' ? toggle : null}
      <form
        className={returnTo === 'board' ? `${styles.form} ${styles.onBoard}` : styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (node.isCharacter && kind !== 'character') {
            setConfirmingKind(true);
            return;
          }
          save();
        }}
      >
        <label className={styles.field}>
          <MonoLabel size={9} tracking="0.14em" block>
            Название
          </MonoLabel>
          <input
            className={picker.field}
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
          />
        </label>

        {/* Тип и статус — короткие списки одного порядка, и читаются они парой.
          Название забрало бы у них всю строку, поэтому стоит выше отдельно. */}
        <div className={styles.row}>
          <label className={styles.field}>
            <MonoLabel size={9} tracking="0.14em" block>
              Тип
            </MonoLabel>
            <select
              className={picker.field}
              value={node.hasPlayer ? 'character' : kind}
              disabled={node.hasPlayer}
              title={node.hasPlayer ? 'У персонажа игрока тип не меняется' : undefined}
              onChange={(e) => setKind(e.currentTarget.value as NodeKind)}
            >
              {node.hasPlayer ? (
                <option value="character">{NODE_KIND_TITLE.character}</option>
              ) : (
                KINDS.map((item) => (
                  <option key={item} value={item}>
                    {NODE_KIND_TITLE[item]}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className={`${styles.field} ${styles.status}`}>
            <MonoLabel size={9} tracking="0.14em" block>
              Статус
            </MonoLabel>
            <select
              className={picker.field}
              value={status}
              onChange={(e) => setStatus(e.currentTarget.value)}
            >
              {STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className={styles.field}>
          <MonoLabel size={9} tracking="0.14em" block>
            Описание
          </MonoLabel>
          <textarea
            className={`${picker.field} ${styles.textarea}`}
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            placeholder="Что о ней известно"
          />
        </label>

        {!node.isCharacter && kind === 'character' ? (
          <MonoLabel size={9} tracking="0.06em" tone="faint" block>
            Станет гостевым персонажем: появится своя страница, а в «Партию» его переводит тумблер
            на карточке
          </MonoLabel>
        ) : null}

        {name !== node.name ? (
          <MonoLabel size={9} tracking="0.06em" tone="faint" block>
            {`Прежнее имя «${node.name}» уйдёт в алиасы — [[ссылки]] в старых записях не сломаются`}
          </MonoLabel>
        ) : null}

        {error ? (
          <MonoLabel size={10} tracking="0.06em" tone="accent" block>
            {error}
          </MonoLabel>
        ) : null}

        <div className={styles.buttons}>
          <button type="submit" className={styles.submit} disabled={pending}>
            СОХРАНИТЬ
          </button>
          <button
            type="button"
            className={styles.cancel}
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            ОТМЕНА
          </button>

          {/* Персонажа игрока не удаляем: у игрока своя учётка и своя страница. */}
          {!node.hasPlayer ? (
            <button
              type="button"
              className={styles.danger}
              disabled={pending}
              title="Удалить сущность"
              onClick={() => setConfirming(true)}
            >
              УДАЛИТЬ
            </button>
          ) : null}
        </div>
      </form>

      {/* Окна подтверждения — рядом с формой, а не внутри: у всплывающей формы
          свой z-index, и в нём затемнение легло бы под «О проекте» и полосу
          быстрой записи. */}
      {confirming ? (
        <ConfirmDialog
          title="Удалить сущность?"
          body={
            node.isCharacter
              ? 'Исчезнут портрет, достижения, связи на доске и упоминания в графе. Текст записей не изменится: ссылки останутся, но станут простым текстом.'
              : 'Исчезнут её связи на доске и упоминания в графе. Текст записей не изменится: ссылки на неё останутся, но станут простым текстом.'
          }
          quoted={node.name}
          confirmLabel="УДАЛИТЬ"
          pending={pending}
          onConfirm={() =>
            startTransition(async () => {
              const result = await deleteNode(node.id);
              if (!result.ok) {
                setError(result.error);
                setConfirming(false);
                return;
              }
              router.replace('/board');
              router.refresh();
            })
          }
          onCancel={() => setConfirming(false)}
        />
      ) : null}

      {confirmingKind ? (
        <ConfirmDialog
          title="Перестанет быть персонажем?"
          body={`Тип сменится на «${NODE_KIND_TITLE[kind]}». Портрет, биография и достижения персонажа пропадут, связи и упоминания останутся.`}
          quoted={node.name}
          confirmLabel="СМЕНИТЬ ТИП"
          pending={pending}
          onConfirm={save}
          onCancel={() => setConfirmingKind(false)}
        />
      ) : null}
    </>
  );
}
