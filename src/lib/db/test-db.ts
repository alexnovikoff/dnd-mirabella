/* База в памяти для тестов: те же миграции, что и у приложения. */

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from './schema';
import type { Db } from './client';

export async function createTestDb(): Promise<Db> {
  const client = await PGlite.create();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: `${process.cwd()}/drizzle` });
  return db;
}
