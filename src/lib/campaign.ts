/** Заглушки этапа 1.
 *
 * На этапе 2 это станет строками Campaign и Session из БД, на этапе 9 —
 * сессия Auth.js. Пока держим в одном месте, чтобы было очевидно, что
 * заменить, и чтобы оболочка выглядела как в прототипе.
 */

export const CAMPAIGN = {
  title: 'Слёзы Мирабеллы',
  /** Буква на круглой печати слева в шапке. */
  seal: 'М',
} as const;

/** Активная игровая сессия — к ней привязываются новые записи (этап 4). */
export const ACTIVE_SESSION = {
  number: 14,
  label: 'Сессия 14 · 6 сент',
} as const;

export type Role = 'player' | 'dm';

export type StubUser = {
  name: string;
  /** Инициал в круглом аватаре чипа. */
  initial: string;
  role: Role;
};

/** Кого показывать в чипе аккаунта до появления настоящей аутентификации.
 *  null — разлогиненное состояние (в шапке кнопка «ВОЙТИ»). */
export const STUB_USER: StubUser | null = {
  name: 'Метель',
  initial: 'М',
  role: 'player',
};
