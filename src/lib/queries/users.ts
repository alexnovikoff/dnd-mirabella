import { asc } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';

/** Имена учёток для выбора на странице входа: регистрации нет,
 *  список закрытый, поэтому его можно показать. */
export function getAccountNames(): Promise<string[]> {
  return runDb(async (db) => {
    const rows = await db.select({ name: t.users.name }).from(t.users).orderBy(asc(t.users.name));
    return rows.map((row) => row.name);
  });
}
