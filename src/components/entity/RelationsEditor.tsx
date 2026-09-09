'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LinkRow, MonoLabel } from '@/components/primitives';
import { ConfirmDialog } from '@/components/editor/ConfirmDialog';
import { NodePicker, type PickerOption } from '@/components/editor/NodePicker';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { deleteLink, linkNodes, updateLink } from '@/lib/actions/board';
import picker from '@/components/editor/Picker.module.css';
import styles from './RelationsEditor.module.css';

export type Relation = {
  linkId: string;
  id: string;
  name: string;
  slug: string;
  label: string | null;
};

export function RelationsEditor({
  nodeId,
  relations,
  candidates,
  labels,
}: {
  nodeId: string;
  relations: Relation[];
  candidates: PickerOption[];
  /** Уже использованные типы связи — подсказками в поле. */
  labels: string[];
}) {
  const router = useRouter();
  const { canWrite } = useQuickEntry();
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState<PickerOption | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [removing, setRemoving] = useState<Relation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function saveLabel(relation: Relation, value: string) {
    if (value === (relation.label ?? '')) return;
    startTransition(async () => {
      await updateLink(relation.linkId, value);
      router.refresh();
    });
  }

  if (!canWrite) {
    return (
      <div className={styles.list}>
        {relations.length === 0 ? (
          <MonoLabel size={9} tracking="0.08em" tone="faint">
            Связей пока нет
          </MonoLabel>
        ) : (
          relations.map((relation) => (
            <LinkRow
              key={relation.linkId}
              arrow
              name={relation.name}
              label={relation.label?.toUpperCase()}
              href={`/entities/${relation.slug}`}
            />
          ))
        )}
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {relations.map((relation) => (
        <div key={relation.linkId} className={styles.row}>
          <Link href={`/entities/${relation.slug}`} className={styles.name}>
            → {relation.name}
          </Link>

          {/* Ярлык правится на месте: сохраняем по Enter и по уходу фокуса. */}
          <input
            className={styles.labelInput}
            defaultValue={relation.label ?? ''}
            placeholder="ТИП СВЯЗИ"
            list="relation-labels"
            aria-label={`Тип связи с «${relation.name}»`}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              saveLabel(relation, event.currentTarget.value);
              event.currentTarget.blur();
            }}
            onBlur={(event) => saveLabel(relation, event.currentTarget.value)}
          />

          <button
            type="button"
            className={styles.remove}
            title="Убрать связь"
            aria-label={`Убрать связь с «${relation.name}»`}
            onClick={() => setRemoving(relation)}
          >
            ×
          </button>
        </div>
      ))}

      <datalist id="relation-labels">
        {labels.map((label) => (
          <option key={label} value={label} />
        ))}
      </datalist>

      {adding ? (
        <div className={styles.addRow}>
          <div className={styles.addField}>
            <NodePicker
              label="С каким узлом"
              placeholder="Начните вводить имя"
              options={candidates}
              value={target}
              onChange={setTarget}
            />
          </div>

          <div className={styles.addField}>
            <MonoLabel size={9} tracking="0.14em" block>
              Тип связи
            </MonoLabel>
            <input
              className={picker.field}
              value={newLabel}
              onChange={(e) => setNewLabel(e.currentTarget.value)}
              placeholder="Долг, вражда, след…"
              list="relation-labels"
            />
          </div>

          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.submit}
              disabled={pending}
              onClick={() => {
                if (!target) {
                  setError('Выберите узел');
                  return;
                }
                setError(null);
                startTransition(async () => {
                  const result = await linkNodes(nodeId, target.id, newLabel);
                  if (result && !result.ok) {
                    setError(result.error);
                    return;
                  }
                  setAdding(false);
                  setTarget(null);
                  setNewLabel('');
                  router.refresh();
                });
              }}
            >
              СВЯЗАТЬ
            </button>
            <button
              type="button"
              className={styles.cancel}
              onClick={() => {
                setAdding(false);
                setTarget(null);
                setError(null);
              }}
            >
              ОТМЕНА
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.addButton} onClick={() => setAdding(true)}>
          + Связь
        </button>
      )}

      {error ? (
        <MonoLabel size={10} tracking="0.06em" tone="accent" block>
          {error}
        </MonoLabel>
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Убрать связь?"
          body="Исчезнет только эта связь между двумя сущностями. Сами сущности и записи останутся."
          quoted={`${removing.name}${removing.label ? ` · ${removing.label}` : ''}`}
          confirmLabel="УБРАТЬ"
          pending={pending}
          onConfirm={() =>
            startTransition(async () => {
              await deleteLink(removing.linkId);
              setRemoving(null);
              router.refresh();
            })
          }
          onCancel={() => setRemoving(null)}
        />
      ) : null}
    </div>
  );
}
