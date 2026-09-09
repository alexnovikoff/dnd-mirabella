/* Соединение с базой.
 *
 * Драйвер выбирается по DATABASE_URL: строка есть — Neon (так работает
 * продакшен на Vercel), строки нет — встроенный PGlite в ./.pglite
 * (так работает локальная разработка и CI). Диалект, схема и миграции
 * у них общие, поэтому весь слой запросов о выборе драйвера не знает.
 *
 * Приложение базу только открывает. Миграции и сид — отдельный процесс,
 * `pnpm db:setup` (см. setup.ts).
 */

import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

/* Без node:fs и node:path: instrumentation.ts тянет этот модуль в том числе
 * в сборку edge-рантайма, где схема node: не разрешается. */
const DATA_DIR = `${process.cwd()}/.pglite`;

/* Общий тип поверх обоих драйверов: и neon-http, и pglite — это Postgres
 * от drizzle, разница только в том, чем исполняется запрос. */
type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

function neonUrl(): string | undefined {
  return process.env.DATABASE_URL || undefined;
}

/* Dev-сервер пересоздаёт модули при горячей перезагрузке, а Next вдобавок
 * собирает отдельные графы модулей для слоёв RSC и SSR — этот модуль живёт
 * в процессе в нескольких экземплярах. Поэтому и соединение, и очередь
 * держим на globalThis: иначе получаются два PGlite и две очереди. */
const globalForDb = globalThis as unknown as {
  __mirabellaDb?: Promise<Db>;
  __mirabellaQueue?: Promise<unknown>;
};

async function open(): Promise<Db> {
  const url = neonUrl();

  /* Динамический импорт, а не статический: в бандл, который уезжает на
   * Vercel, незачем тащить wasm PGlite, а в CI и локально — драйвер Neon. */
  if (url) {
    const [{ neon }, { drizzle }] = await Promise.all([
      import('@neondatabase/serverless'),
      import('drizzle-orm/neon-http'),
    ]);
    return drizzle(neon(url), { schema });
  }

  try {
    const [{ PGlite }, { drizzle }] = await Promise.all([
      import('@electric-sql/pglite'),
      import('drizzle-orm/pglite'),
    ]);
    /* Асинхронная фабрика: обычный конструктор возвращает объект
     * до готовности wasm, и первый же запрос может упасть. */
    const client = await PGlite.create(DATA_DIR);
    return drizzle(client, { schema });
  } catch (cause) {
    throw new Error('Не удалось открыть локальную базу. Запустите: pnpm db:setup', { cause });
  }
}

function getDb(): Promise<Db> {
  globalForDb.__mirabellaDb ??= open();
  return globalForDb.__mirabellaDb;
}

/** Открыть соединение на старте сервера, до первого рендера.
 *  Внутри рендера инициализация wasm у PGlite падает — см. instrumentation.ts. */
export function warmDb(): Promise<Db> {
  return getDb();
}

/* PGlite — одно соединение на процесс, и параллельные запросы к нему рвут
 * его wasm-буфер. Поэтому весь доступ к базе идёт через очередь: страница
 * спокойно делает Promise.all, а сюда запросы приходят по одному. У Neon
 * параллелизм штатный, там очередь только мешала бы — и её нет. */
export function runDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  if (neonUrl()) return getDb().then(fn);

  const previous = globalForDb.__mirabellaQueue ?? Promise.resolve();
  const result = previous.then(async () => fn(await getDb()));
  globalForDb.__mirabellaQueue = result.catch(() => undefined);
  return result;
}

/** Подменить соединение на тестовое. Единственный шов, ради которого слой
 *  запросов вообще можно проверить: сами запросы ходят через runDb и о базе
 *  ничего не знают. В приложении не вызывается. */
export function setDbForTesting(db: Db | null): void {
  globalForDb.__mirabellaDb = db ? Promise.resolve(db) : undefined;
  globalForDb.__mirabellaQueue = undefined;
}

export type { Db };
