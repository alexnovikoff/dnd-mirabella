/* Открыть базу из отдельного процесса: миграции, сид, смена пароля.
 *
 * Приложение подключается через client.ts и ничего не мигрирует; скриптам
 * нужен и мигратор, и закрытие соединения. Драйвер выбирается так же —
 * по DATABASE_URL: есть строка — Neon, нет — локальный PGlite.
 */

import path from 'node:path';
import type { Db } from './client';
import * as schema from './schema';

const MIGRATIONS = path.join(process.cwd(), 'drizzle');

export type OpenedDb = {
  db: Db;
  /** Куда подключились — для сообщений в консоль. */
  where: string;
  migrate: () => Promise<void>;
  close: () => Promise<void>;
};

export async function openDb(): Promise<OpenedDb> {
  const url = process.env.DATABASE_URL;

  if (url) {
    const [{ neon }, { drizzle }, { migrate }] = await Promise.all([
      import('@neondatabase/serverless'),
      import('drizzle-orm/neon-http'),
      import('drizzle-orm/neon-http/migrator'),
    ]);
    const db = drizzle(neon(url), { schema });
    return {
      db,
      where: 'Neon',
      migrate: () => migrate(db, { migrationsFolder: MIGRATIONS }),
      /* HTTP-драйвер соединения не держит — закрывать нечего. */
      close: async () => {},
    };
  }

  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
    import('drizzle-orm/pglite/migrator'),
  ]);

  let client;
  try {
    client = await PGlite.create(path.join(process.cwd(), '.pglite'));
  } catch (cause) {
    /* Самая частая причина — запущенный dev-сервер: PGlite держит папку
     * одним процессом. */
    throw new Error(
      'Не удалось открыть локальную базу в ./.pglite. Если запущен pnpm dev — остановите его: PGlite открывается одним процессом.',
      { cause },
    );
  }

  const db = drizzle(client, { schema });
  return {
    db,
    where: 'локальный PGlite',
    migrate: () => migrate(db, { migrationsFolder: MIGRATIONS }),
    close: () => client.close(),
  };
}
