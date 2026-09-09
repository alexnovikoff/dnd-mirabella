'use client';

import { useMemo, useRef, useState } from 'react';
import { MonoLabel } from '@/components/primitives';
import { NODE_KIND_LABEL } from '@/lib/nodes';
import type { PickerNode } from '@/lib/queries/nodes';
import picker from './Picker.module.css';
import styles from './WikiTextarea.module.css';

const MAX_OPTIONS = 6;

/** Незакрытая `[[` перед кареткой — иначе автодополнение не показываем. */
function activeQuery(value: string, caret: number): { start: number; query: string } | null {
  const before = value.slice(0, caret);
  const start = before.lastIndexOf('[[');
  if (start === -1) return null;

  const between = before.slice(start + 2);
  if (between.includes(']]') || between.includes('\n')) return null;

  return { start, query: between };
}

export type WikiTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  nodes: PickerNode[];
  placeholder?: string;
  /** Создаёт черновую сущность по опции «+ создать «…»». */
  onCreateNode: (name: string) => Promise<PickerNode>;
  rows?: number;
};

export function WikiTextarea({
  value,
  onChange,
  nodes,
  placeholder,
  onCreateNode,
  rows,
}: WikiTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const [highlighted, setHighlighted] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const active = dismissed ? null : activeQuery(value, caret);

  const matches = useMemo(() => {
    if (!active) return [];
    const query = active.query.trim().toLowerCase();
    const list = query ? nodes.filter((node) => node.name.toLowerCase().includes(query)) : nodes;
    return list.slice(0, MAX_OPTIONS);
  }, [active, nodes]);

  const typed = active?.query.trim() ?? '';
  const exact = matches.some((node) => node.name.toLowerCase() === typed.toLowerCase());
  const canCreate = typed.length > 0 && !exact;
  const optionCount = matches.length + (canCreate ? 1 : 0);
  const open = active !== null && optionCount > 0;
  const index = Math.min(highlighted, Math.max(optionCount - 1, 0));

  function insert(name: string) {
    if (!active) return;
    const next = `${value.slice(0, active.start)}[[${name}]]${value.slice(caret)}`;
    const position = active.start + name.length + 4;

    onChange(next);
    setHighlighted(0);

    /* Каретку двигаем после перерисовки, иначе она уедет в конец. */
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(position, position);
      setCaret(position);
    });
  }

  async function choose(position: number) {
    if (position < matches.length) {
      insert(matches[position].name);
      return;
    }
    const created = await onCreateNode(typed);
    insert(created.name);
  }

  function syncCaret(el: HTMLTextAreaElement) {
    setCaret(el.selectionStart ?? 0);
    setDismissed(false);
  }

  return (
    <div className={styles.wrap}>
      <textarea
        ref={ref}
        className={styles.field}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.currentTarget.value);
          syncCaret(e.currentTarget);
          setHighlighted(0);
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
        onClick={(e) => syncCaret(e.currentTarget)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlighted((i) => (i + 1) % optionCount);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlighted((i) => (i - 1 + optionCount) % optionCount);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            void choose(index);
          } else if (e.key === 'Escape') {
            /* Первый Escape закрывает подсказки, второй — всю модалку. */
            e.stopPropagation();
            setDismissed(true);
          }
        }}
      />

      {open ? (
        <div className={picker.panel}>
          <div className={picker.panelHead}>
            <MonoLabel size={9} tracking="0.1em">
              Подставить сущность
            </MonoLabel>
          </div>

          {matches.map((node, i) => (
            <button
              key={node.id}
              type="button"
              className={i === index ? `${picker.option} ${picker.optionActive}` : picker.option}
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => void choose(i)}
            >
              {node.name}
              <MonoLabel size={9} tracking="0.06em" tone="faint">
                {NODE_KIND_LABEL[node.kind]}
              </MonoLabel>
            </button>
          ))}

          {canCreate ? (
            <button
              type="button"
              className={
                index === matches.length
                  ? `${picker.option} ${picker.create} ${picker.optionActive}`
                  : `${picker.option} ${picker.create}`
              }
              onMouseEnter={() => setHighlighted(matches.length)}
              onClick={() => void choose(matches.length)}
            >
              {`+ создать «${typed}»`}
            </button>
          ) : null}
        </div>
      ) : (
        <div className={styles.hint}>
          <MonoLabel size={9} tracking="0.08em" tone="faint">
            Двойные скобки — ссылка на сущность
          </MonoLabel>
        </div>
      )}
    </div>
  );
}
