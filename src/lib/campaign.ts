/** Заглушка аутентификации до этапа 9.
 *
 * Кампания, активная сессия и партия теперь приходят из базы (см. lib/queries).
 * Здесь остался только вошедший пользователь — его заменит сессия Auth.js.
 */

export type Role = 'player' | 'dm';

export type StubUser = {
  name: string;
  /** Инициал в круглом аватаре чипа. */
  initial: string;
  role: Role;
};

/** null — разлогиненное состояние: в шапке кнопка «ВОЙТИ». */
export const STUB_USER: StubUser | null = {
  name: 'Метель',
  initial: 'М',
  role: 'player',
};
