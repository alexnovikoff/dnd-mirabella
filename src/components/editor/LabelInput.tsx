'use client';

import { useRef, useState } from 'react';
import picker from './Picker.module.css';
import styles from './LabelInput.module.css';

/**
 * Поле типа связи с выпадающим списком уже использованных значений.
 *
 * Нативный datalist здесь не годится: браузер фильтрует его по тому, что уже
 * введено, поэтому у связи с заполненным типом список при клике не
 * показывался вовсе. Здесь по клику видно все варианты, а фильтрация
 * начинается только когда человек начал печатать. Своё значение вводить
 * по-прежнему можно.
 */
export function LabelInput({
  value,
  labels,
  onCommit,
  placeholder,
  ariaLabel,
  className,
  autoFocus = false,
}: {
  value: string;
  labels: string[];
  onCommit: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  /** В окне типа связи поле — единственное, и курсор должен стоять в нём. */
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  /* При автофокусе список не раскрываем: он бы сразу накрыл кнопки окна.
   * Дальше фокус ведёт себя как обычно — по клику список открывается. */
  const listOnFocus = useRef(!autoFocus);

  const needle = text.trim().toLowerCase();
  const options = (
    typed && needle ? labels.filter((l) => l.toLowerCase().includes(needle)) : labels
  )
    .filter((label) => label.toLowerCase() !== text.trim().toLowerCase())
    .slice(0, 8);

  function commit(next: string) {
    setText(next);
    setOpen(false);
    setTyped(false);
    onCommit(next);
  }

  return (
    <div className={className ? `${styles.wrap} ${className}` : styles.wrap}>
      <div className={styles.field}>
        <input
          ref={inputRef}
          className={`${picker.field} ${styles.input}`}
          value={text}
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoComplete="off"
          autoFocus={autoFocus}
          onFocus={() => {
            setTyped(false);
            if (!listOnFocus.current) {
              listOnFocus.current = true;
              return;
            }
            setOpen(true);
          }}
          onChange={(event) => {
            setText(event.currentTarget.value);
            setTyped(true);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit(event.currentTarget.value);
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
          onBlur={(event) => commit(event.currentTarget.value)}
        />

        {/* Явная стрелка: список должен открываться по клику, а не только
            по фокусу — иначе у заполненного поля его будто и нет. */}
        {labels.length > 0 ? (
          <button
            type="button"
            className={styles.toggle}
            aria-label="Показать типы связи"
            aria-expanded={open}
            tabIndex={-1}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setTyped(false);
              setOpen((value) => !value);
              inputRef.current?.focus();
            }}
          >
            ▾
          </button>
        ) : null}
      </div>

      {open && options.length > 0 ? (
        <div className={`${picker.panel} ${styles.panel}`} role="listbox">
          {options.map((label) => (
            <button
              key={label}
              type="button"
              role="option"
              aria-selected={false}
              className={picker.option}
              /* Не даём полю потерять фокус раньше, чем сработает клик. */
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commit(label)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
