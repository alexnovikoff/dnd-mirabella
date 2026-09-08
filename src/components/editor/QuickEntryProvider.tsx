'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { QuickEntry } from './QuickEntry';
import type { PickerNode } from '@/lib/queries/nodes';

type QuickEntryContext = { open: () => void };

const Context = createContext<QuickEntryContext | null>(null);

export function useQuickEntry(): QuickEntryContext {
  const value = useContext(Context);
  if (!value) throw new Error('useQuickEntry вне QuickEntryProvider');
  return value;
}

/** Открывает шит быстрой записи: кнопкой «+ ЗАПИСЬ» в шапке и клавишей «n». */
export function QuickEntryProvider({
  nodes,
  characters,
  sessionShort,
  children,
}: {
  nodes: PickerNode[];
  characters: PickerNode[];
  sessionShort: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const value = useMemo(() => ({ open }), [open]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'n' || event.metaKey || event.ctrlKey || event.altKey) return;

      /* Не перехватываем «n», когда человек печатает. */
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      event.preventDefault();
      setIsOpen(true);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Context.Provider value={value}>
      {children}
      {isOpen ? (
        <QuickEntry
          nodes={nodes}
          characters={characters}
          sessionShort={sessionShort}
          onClose={close}
        />
      ) : null}
    </Context.Provider>
  );
}
