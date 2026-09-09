/* Подготовка базы: миграции и сид. Запускается отдельным процессом
 * (`pnpm db:setup`), а не внутри рендера — PGlite сбрасывает свою wasm-память
 * на диск, и запрос, попавший в момент сброса, падает с «ArrayBuffer is not
 * detachable». С Neon то же разделение остаётся в силе: миграции идут
 * отдельным шагом, приложение только подключается.
 *
 * Куда именно — решает DATABASE_URL (см. open.ts). Строка берётся из
 * окружения или из .env: скрипт запускается с --env-file-if-exists.
 * Локальный пересев — `pnpm db:reset`, он игнорирует DATABASE_URL.
 */

import { openDb } from './open';
import * as schema from './schema';
import { seed } from './seed';

async function main() {
  const { db, where, migrate, close } = await openDb();

  await migrate();

  /* Сид накатывается только на пустую базу: повторный запуск безвреден. */
  const existing = await db.select({ id: schema.campaigns.id }).from(schema.campaigns).limit(1);

  if (existing.length > 0) {
    console.log(`Миграции накачены (${where}). База уже засеяна — сид пропускаю.`);
  } else {
    await seed(db);
    console.log(`База засеяна (${where}).`);
    console.log(
      `Учётки: Аэлис, Джаду, Метель, Оген, Мастер. Пароль у всех один — «${
        process.env.SEED_PASSWORD ?? 'мирабелла'
      }».`,
    );
    console.log('Он временный. Свой пароль каждому: pnpm auth:password «Имя».');
  }

  await close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
