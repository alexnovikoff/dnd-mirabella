/* Подготовка локальной базы: миграции и сид. Запускается отдельным процессом
 * (`pnpm db:setup`), а не внутри рендера — PGlite сбрасывает свою wasm-память
 * на диск, и запрос, попавший в момент сброса, падает с «ArrayBuffer is not
 * detachable». С Neon будет ровно так же: миграции идут отдельным шагом,
 * приложение только подключается.
 */

import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from './schema';
import { seed } from './seed';

async function main() {
  const client = await PGlite.create(path.join(process.cwd(), '.pglite'));
  const db = drizzle(client, { schema });

  await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });

  const existing = await db.select({ id: schema.campaigns.id }).from(schema.campaigns).limit(1);
  if (existing.length > 0) {
    console.log('База уже засеяна — пропускаю. Чистый пересев: pnpm db:reset');
  } else {
    await seed(db);
    console.log('База засеяна.');
  }

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
