/* Общие типы сессии. Отдельный файл, чтобы их можно было импортировать
 * и в клиентских компонентах, не таща за собой серверный next-auth. */

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
