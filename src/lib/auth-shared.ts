/* Общие типы сессии. Отдельный файл, чтобы их можно было импортировать
 * и в клиентских компонентах, не таща за собой серверный next-auth. */

import type { Visibility } from '@/lib/db/schema';

/** Короче — не пароль. То же ограничение проверяет pnpm auth:password. */
export const MIN_PASSWORD_LENGTH = 8;

export type Role = 'player' | 'dm';

export type Viewer = {
  id: string;
  name: string;
  initial: string;
  role: Role;
  /** Слаг персонажа игрока — для пункта меню «Профиль». */
  characterSlug: string | null;
};

export function isDm(viewer: Viewer | null): boolean {
  return viewer?.role === 'dm';
}

/** Кто правит запись. Правило одно: правит тот, кто видит.
 *
 *  — общее (public) правит любой вошедший: хронику ведут вместе, и чинить
 *    чужую опечатку или дописать момент — обычное дело, а не покушение;
 *  — личная заметка (private) остаётся за автором и мастером;
 *  — чужой черновик и скрытое от игроков (dm_only) игрок не видит, значит
 *    и править их может только автор либо мастер.
 *
 *  Ту же проверку повторяет сервер: здесь она лишь прячет кнопки. */
export function canEditEntry(
  viewer: Viewer | null,
  entry: { authorId: string | null; visibility: Visibility },
): boolean {
  if (!viewer) return false;
  if (viewer.role === 'dm') return true;
  if (entry.visibility === 'public') return true;
  return entry.authorId === viewer.id;
}
