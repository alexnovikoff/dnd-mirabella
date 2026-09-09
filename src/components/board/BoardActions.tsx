'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MonoLabel } from '@/components/primitives';
import { NodePicker, type PickerOption } from '@/components/editor/NodePicker';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { ConfirmDialog } from '@/components/editor/ConfirmDialog';
import { createBoardNode, linkNodes } from '@/lib/actions/board';
import { deleteNode } from '@/lib/actions/nodes';
import { NODE_KIND_LABEL } from '@/lib/nodes';
import type { NodeKind } from '@/lib/db/schema';
import picker from '@/components/editor/Picker.module.css';
import styles from './Board.module.css';

/** Типы, которые имеет смысл заводить с доски. Персонажи заводятся не здесь. */
const KINDS: NodeKind[] = ['npc', 'location', 'faction', 'artifact', 'event', 'rumor', 'unknown'];

const LEGEND = [
  { color: 'var(--status-open)', label: 'ОТКРЫТА' },
  { color: 'var(--status-done)', label: 'РАСКРЫТА' },
  { color: 'var(--status-dead)', label: 'ТУПИК' },
];

/** Тулбар доски: заголовок, легенда и создание узла формой на месте. */
export function BoardToolbar() {
  const { canWrite } = useQuickEntry();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>Доска связей</h1>
        <div className={styles.tools}>
          {LEGEND.map((item) => (
            <span key={item.label} className={styles.legendItem}>
              <span className={styles.swatch} style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
          <span className={styles.legendItem} title="Узлы названы в одной записи">
            <span className={styles.derivedLine} />
            ИЗ ТЕКСТА
          </span>
          {canWrite ? (
            <button
              type="button"
              className={styles.addNode}
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
            >
              {open ? '× ОТМЕНА' : '+ УЗЕЛ'}
            </button>
          ) : null}
        </div>
      </div>

      {open ? <AddNodeForm onDone={() => setOpen(false)} /> : null}
    </>
  );
}

function AddNodeForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<NodeKind>('npc');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createBoardNode(name, kind);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setName('');
          router.refresh();
          onDone();
        });
      }}
    >
      <div className={styles.formField}>
        <MonoLabel size={9} tracking="0.14em" block>
          Название узла
        </MonoLabel>
        <input
          className={picker.field}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Кузница Стоунфеллоу"
          autoFocus
          required
        />
      </div>

      <div className={styles.formField}>
        <MonoLabel size={9} tracking="0.14em" block>
          Тип
        </MonoLabel>
        <select
          className={picker.field}
          value={kind}
          onChange={(e) => setKind(e.currentTarget.value as NodeKind)}
        >
          {KINDS.map((item) => (
            <option key={item} value={item}>
              {NODE_KIND_LABEL[item]}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" className={styles.formSubmit} disabled={pending}>
        ДОБАВИТЬ
      </button>

      {error ? (
        <MonoLabel size={10} tracking="0.06em" tone="accent" block>
          {error}
        </MonoLabel>
      ) : null}
    </form>
  );
}

export function LinkNodeButton({
  fromNodeId,
  candidates,
  labels,
}: {
  fromNodeId: string;
  candidates: PickerOption[];
  labels: string[];
}) {
  const router = useRouter();
  const { canWrite } = useQuickEntry();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<PickerOption | null>(null);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canWrite) return null;

  if (!open) {
    return (
      <button type="button" className={styles.linkButton} onClick={() => setOpen(true)}>
        СВЯЗАТЬ С УЗЛОМ…
      </button>
    );
  }

  return (
    <form
      className={styles.linkForm}
      onSubmit={(event) => {
        event.preventDefault();
        if (!target) {
          setError('Выберите узел');
          return;
        }
        setError(null);
        startTransition(async () => {
          const result = await linkNodes(fromNodeId, target.id, label);
          if (result && !result.ok) {
            setError(result.error);
            return;
          }
          setOpen(false);
          setTarget(null);
          setLabel('');
          router.refresh();
        });
      }}
    >
      <NodePicker
        label="С каким узлом"
        placeholder="Начните вводить имя"
        options={candidates}
        value={target}
        onChange={setTarget}
      />

      <div className={styles.formField}>
        <MonoLabel size={9} tracking="0.14em" block>
          Тип связи
        </MonoLabel>
        <input
          className={picker.field}
          value={label}
          onChange={(e) => setLabel(e.currentTarget.value)}
          placeholder="Долг, вражда, след…"
          list="link-labels"
        />
        <datalist id="link-labels">
          {labels.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </div>

      {error ? (
        <MonoLabel size={10} tracking="0.06em" tone="accent" block>
          {error}
        </MonoLabel>
      ) : null}

      <div className={styles.formButtons}>
        <button
          type="button"
          className={styles.formCancel}
          onClick={() => {
            setOpen(false);
            setTarget(null);
            setError(null);
          }}
        >
          ОТМЕНА
        </button>
        <button type="submit" className={styles.formSubmit} disabled={pending}>
          СВЯЗАТЬ
        </button>
      </div>
    </form>
  );
}

/** Убрать выбранный узел прямо с доски. Персонажа партии удалить нельзя —
 *  у него своя строка в characters и своя страница. */
export function DeleteNodeButton({
  nodeId,
  name,
  isCharacter,
}: {
  nodeId: string;
  name: string;
  isCharacter: boolean;
}) {
  const router = useRouter();
  const { canWrite } = useQuickEntry();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canWrite || isCharacter) return null;

  return (
    <>
      <button type="button" className={styles.deleteNode} onClick={() => setConfirming(true)}>
        УДАЛИТЬ УЗЕЛ
      </button>

      {error ? (
        <MonoLabel size={10} tracking="0.06em" tone="accent" block>
          {error}
        </MonoLabel>
      ) : null}

      {confirming ? (
        <ConfirmDialog
          title="Удалить узел?"
          body="Исчезнут его связи на доске и упоминания в графе. Текст записей не изменится: ссылки на него останутся, но станут простым текстом."
          quoted={name}
          confirmLabel="УДАЛИТЬ"
          pending={pending}
          onConfirm={() =>
            startTransition(async () => {
              const result = await deleteNode(nodeId);
              if (!result.ok) {
                setError(result.error);
                setConfirming(false);
                return;
              }
              setConfirming(false);
              router.replace('/board');
              router.refresh();
            })
          }
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </>
  );
}
