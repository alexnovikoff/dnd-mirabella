'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MonoLabel } from '@/components/primitives';
import { ConfirmDialog } from '@/components/editor/ConfirmDialog';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { deleteNode, updateNode } from '@/lib/actions/nodes';
import { NODE_KIND_TITLE } from '@/lib/nodes';
import type { NodeKind, NodeStatus } from '@/lib/db/schema';
import picker from '@/components/editor/Picker.module.css';
import styles from './EntityEditor.module.css';

const KINDS: NodeKind[] = ['npc', 'location', 'faction', 'artifact', 'event', 'rumor', 'unknown'];

const STATUSES: { value: string; label: string }[] = [
  { value: '', label: 'БЕЗ СТАТУСА' },
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
    isCharacter: boolean;
  };
}) {
  const router = useRouter();
  const { canWrite } = useQuickEntry();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(node.name);
  const [kind, setKind] = useState<NodeKind>(node.kind);
  const [status, setStatus] = useState<string>(node.status ?? '');
  const [description, setDescription] = useState(node.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!canWrite) return null;

  if (!open) {
    return (
      <div className={styles.bar}>
        <button type="button" className={styles.action} onClick={() => setOpen(true)}>
          Править
        </button>
        {node.aliases.length > 0 ? (
          <MonoLabel size={9} tracking="0.06em" tone="faint">
            {`Прежние имена: ${node.aliases.join(', ')}`}
          </MonoLabel>
        ) : null}
      </div>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await updateNode(node.id, {
            name,
            kind,
            status: (status || null) as NodeStatus | null,
            description,
          });
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
      }}
    >
      <div className={styles.row}>
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

        <label className={styles.field}>
          <MonoLabel size={9} tracking="0.14em" block>
            Тип
          </MonoLabel>
          <select
            className={picker.field}
            value={node.isCharacter ? 'character' : kind}
            disabled={node.isCharacter}
            title={node.isCharacter ? 'У персонажа партии тип не меняется' : undefined}
            onChange={(e) => setKind(e.currentTarget.value as NodeKind)}
          >
            {node.isCharacter ? (
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

        <label className={styles.field}>
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
          onClick={() => {
            setOpen(false);
            setError(null);
            setName(node.name);
            setKind(node.kind);
            setStatus(node.status ?? '');
            setDescription(node.description ?? '');
          }}
        >
          ОТМЕНА
        </button>

        {/* Персонажа партии не удаляем: у него своя строка в characters. */}
        {!node.isCharacter ? (
          <button
            type="button"
            className={styles.danger}
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            УДАЛИТЬ СУЩНОСТЬ
          </button>
        ) : null}
      </div>

      {confirming ? (
        <ConfirmDialog
          title="Удалить сущность?"
          body="Исчезнут её связи на доске и упоминания в графе. Текст записей не изменится: ссылки на неё останутся, но станут простым текстом."
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
    </form>
  );
}
