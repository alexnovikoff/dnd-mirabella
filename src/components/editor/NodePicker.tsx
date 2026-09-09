'use client';

import { useMemo, useState } from 'react';
import { MonoLabel } from '@/components/primitives';
import { NODE_KIND_LABEL } from '@/lib/nodes';
import type { NodeKind } from '@/lib/db/schema';
import picker from './Picker.module.css';

const MAX_OPTIONS = 6;

export type PickerOption = { id: string; name: string; kind?: NodeKind };

/** Поле выбора узла с подсказками. Тот же вид, что у автодополнения `[[`,
 *  но отдельным полем: на доске нет текста, в котором можно поставить скобки. */
export function NodePicker({
  options,
  value,
  onChange,
  placeholder,
  label,
}: {
  options: PickerOption[];
  value: PickerOption | null;
  onChange: (option: PickerOption | null) => void;
  placeholder?: string;
  label: string;
}) {
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle
      ? options.filter((option) => option.name.toLowerCase().includes(needle))
      : options;
    return list.slice(0, MAX_OPTIONS);
  }, [options, query]);

  const open = value === null && matches.length > 0;
  const index = Math.min(highlighted, Math.max(matches.length - 1, 0));

  if (value) {
    return (
      <button
        type="button"
        className={`${picker.option} ${picker.optionActive}`}
        onClick={() => {
          onChange(null);
          setQuery('');
        }}
      >
        {value.name}
        <MonoLabel size={9} tracking="0.06em" tone="faint">
          сменить
        </MonoLabel>
      </button>
    );
  }

  return (
    <div>
      <MonoLabel size={9} tracking="0.14em" block>
        {label}
      </MonoLabel>
      <input
        className={picker.field}
        value={query}
        placeholder={placeholder}
        autoFocus
        onChange={(e) => {
          setQuery(e.currentTarget.value);
          setHighlighted(0);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlighted((i) => (i + 1) % matches.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlighted((i) => (i - 1 + matches.length) % matches.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            onChange(matches[index]);
          }
        }}
      />

      {open ? (
        <div className={picker.panel}>
          {matches.map((option, i) => (
            <button
              key={option.id}
              type="button"
              className={i === index ? `${picker.option} ${picker.optionActive}` : picker.option}
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => onChange(option)}
            >
              {option.name}
              {option.kind ? (
                <MonoLabel size={9} tracking="0.06em" tone="faint">
                  {NODE_KIND_LABEL[option.kind]}
                </MonoLabel>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
