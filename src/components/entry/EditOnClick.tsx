'use client';

import { useRef } from 'react';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import type { EditableEntry } from '@/components/editor/QuickEntry';
import styles from './EditOnClick.module.css';

/** Что внутри карточки кликается само: ссылка ведёт на сущность, кнопки
 *  делают своё, окно подтверждения удаления рендерится прямо в карточке. */
const OWN_CLICK = 'a, button, [role="alertdialog"]';

/** Карточка записи, которая открывается в шит правки кликом в любое место.
 *  Своей страницы у записи нет, а без этого клик по заметке молчал.
 *
 *  Кнопкой сама карточка не становится: внутри неё [[ссылки]], и роль кнопки
 *  спрятала бы их от скринридера. С клавиатуры правку открывает «Править»
 *  из EntryActions. Кто не вправе править, получает карточку как есть. */
export function EditOnClick({
  entry,
  canEdit,
  children,
}: {
  entry: EditableEntry;
  canEdit: boolean;
  children: React.ReactNode;
}) {
  const { openForEdit } = useQuickEntry();
  /* Где нажали. Подложка окна подтверждения закрывает его на mousedown,
   * и click после этого приходит уже в саму карточку — открывать шит
   * по такому клику нельзя: человек отменял удаление. */
  const pressed = useRef<Element | null>(null);

  if (!canEdit) return children;

  return (
    <div
      className={styles.card}
      onPointerDown={(event) => {
        pressed.current = event.target as Element;
      }}
      onClick={(event) => {
        const start = pressed.current;
        pressed.current = null;
        if (!start?.isConnected || !event.currentTarget.contains(start)) return;
        if (start.closest(OWN_CLICK) || (event.target as Element).closest(OWN_CLICK)) return;
        /* Текст протянули мышью, чтобы скопировать, — это не клик. */
        if (window.getSelection()?.toString()) return;
        openForEdit(entry);
      }}
    >
      {children}
    </div>
  );
}
