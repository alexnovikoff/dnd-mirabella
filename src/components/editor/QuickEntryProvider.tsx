'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { QuickEntry, type EditableEntry } from './QuickEntry';
import { QuickEntryBar } from './QuickEntryBar';
import type { EntryKind } from '@/lib/db/schema';
import type { PickerNode } from '@/lib/queries/nodes';
import type { SessionOption } from '@/lib/queries/sessions';

type QuickEntryContext = {
  /** Тип задаёт кнопка экрана: «Новая цитата» открывает шит сразу цитатой.
   *  Сессию — тот, кто уже выбрал её у себя: полоса загрузки на «Галерее»
   *  открывает шит той же группой, что показывает сама. */
  open: (kind?: EntryKind, sessionId?: string) => void;
  /** Открыть шит на правку уже существующей записи. */
  openForEdit: (entry: EditableEntry) => void;
  sessionShort: string;
  canWrite: boolean;
};

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
  sessions,
  sessionShort,
  canWrite,
  isDm,
  children,
}: {
  nodes: PickerNode[];
  characters: PickerNode[];
  /** Сессии для выбора в шите, последняя сверху. */
  sessions: SessionOption[];
  sessionShort: string;
  /** Разлогиненный посетитель читает, но не пишет. */
  canWrite: boolean;
  isDm: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<EditableEntry | null>(null);
  const [kind, setKind] = useState<EntryKind>('moment');
  const [sessionId, setSessionId] = useState<string | null>(null);

  const open = useCallback(
    (next: EntryKind = 'moment', session?: string) => {
      if (!canWrite) return;
      setEditing(null);
      setKind(next);
      setSessionId(session ?? null);
      setIsOpen(true);
    },
    [canWrite],
  );

  const openForEdit = useCallback(
    (entry: EditableEntry) => {
      if (!canWrite) return;
      setEditing(entry);
      setIsOpen(true);
    },
    [canWrite],
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setEditing(null);
  }, []);
  const value = useMemo(
    () => ({ open, openForEdit, sessionShort, canWrite }),
    [open, openForEdit, sessionShort, canWrite],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!canWrite) return;
      if (event.key !== 'n' || event.metaKey || event.ctrlKey || event.altKey) return;

      /* Не перехватываем «n», когда человек печатает. */
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      event.preventDefault();
      open();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [canWrite, open]);

  return (
    <Context.Provider value={value}>
      {children}
      {canWrite ? <QuickEntryBar /> : null}
      {isOpen ? (
        <QuickEntry
          /* Ключ сбрасывает состояние полей при переходе к другой записи. */
          key={editing?.id ?? 'new'}
          entry={editing}
          defaultKind={kind}
          defaultSessionId={sessionId}
          nodes={nodes}
          characters={characters}
          sessions={sessions}
          isDm={isDm}
          onClose={close}
        />
      ) : null}
    </Context.Provider>
  );
}
