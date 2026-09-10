import type { EntryKind } from '@/lib/db/schema';

/** Шесть вкладок глобальной шапки. Порядок из README строгий — не менять. */
export type NavItem = {
  href: string;
  label: string;
  /** Подпись кнопки быстрой записи на этом экране («+ ЗАПИСЬ», «Новая цитата»…). */
  action: string;
  /** Тип, на котором открывается быстрая запись. Не задан — «момент». */
  kind?: EntryKind;
};

export const NAV: readonly NavItem[] = [
  { href: '/', label: 'Хроника', action: '+ ЗАПИСЬ' },
  { href: '/party', label: 'Партия', action: '+ ЗАПИСЬ' },
  { href: '/gallery', label: 'Галерея', action: '+ ФОТО', kind: 'image' },
  { href: '/quotes', label: 'Цитаты', action: 'Новая цитата', kind: 'quote' },
  { href: '/kb', label: 'База знаний', action: '+ ЗАМЕТКА' },
  /* На доске узел заводится своей кнопкой в тулбаре, а кнопка в шапке
   * открывает быструю запись — подписи не должны совпадать. */
  { href: '/board', label: 'Доска связей', action: '+ ЗАПИСЬ' },
] as const;

/** Активна вкладка, чей href — точное совпадение либо префикс пути. */
export function isActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Подпись основной кнопки для текущего маршрута. */
export function actionFor(pathname: string): string {
  return NAV.find((item) => isActive(item.href, pathname))?.action ?? '+ ЗАПИСЬ';
}

/** Тип записи, который заводит кнопка на текущем маршруте. */
export function kindFor(pathname: string): EntryKind | undefined {
  return NAV.find((item) => isActive(item.href, pathname))?.kind;
}
