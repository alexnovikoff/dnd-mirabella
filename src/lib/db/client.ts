/* Локальная база разработки.
 *
 * Neon-проекта пока нет, поэтому Postgres поднимается встроенным PGlite:
 * тот же диалект и те же миграции, что уйдут в Neon, но без установки сервера.
 * Данные лежат в ./.pglite (в .gitignore). Переезд на Neon — замена драйвера
 * здесь на drizzle-orm/neon-http плюс DATABASE_URL; схема и миграции те же.
 *
 * Приложение базу только открывает. Миграции и сид — отдельный процесс,
 * `pnpm db:setup` (см. setup.ts).
 */

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema';

/* Без node:fs и node:path: instrumentation.ts тянет этот модуль в том числе
 * в сборку edge-рантайма, где схема node: не разрешается. */
const DATA_DIR = `${process.cwd()}/.pglite`;

type Db = ReturnType<typeof drizzle<typeof schema>>;

/* Dev-сервер пересоздаёт модули при горячей перезагрузке, а Next вдобавок
 * собирает отдельные графы модулей для слоёв RSC и SSR — этот модуль живёт
 * в процессе в нескольких экземплярах. Поэтому и соединение, и очередь
 * держим на globalThis: иначе получаются два PGlite и две очереди. */
const globalForDb = globalThis as unknown as {
  __mirabellaDb?: Promise<Db>;
  __mirabellaQueue?: Promise<unknown>;
};

async function open(): Promise<Db> {
  try {
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
 * спокойно делает Promise.all, а сюда запросы приходят по одному. При
 * переезде на Neon с его пулом очередь снимается — там параллелизм штатный. */
export function runDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const previous = globalForDb.__mirabellaQueue ?? Promise.resolve();
  const result = previous.then(async () => fn(await getDb()));
  globalForDb.__mirabellaQueue = result.catch(() => undefined);
  return result;
}

export type { Db };
