/* Однократный пересчёт рёбер для уже написанных пересказов сессий.
 *
 *   pnpm db:resync-session-links                                показать, что появится
 *   pnpm db:resync-session-links --apply                        применить
 *   DATABASE_URL='<строка Neon>' pnpm db:resync-session-links --apply
 *
 * Описание сессии умеет [[ссылки]] с самого начала, но рёбра графа по ним
 * не заводились: пересчёт был только у записей. Тексты при этом целы —
 * ссылки в них уже написаны, и достаточно один раз прогнать по ним тот же
 * syncSessionLinks, который теперь работает при каждом сохранении.
 *
 * Повторный запуск безвреден: функция приводит рёбра в соответствие тексту,
 * а не добавляет их. После того как боевая база пересчитана, файл можно
 * удалить.
 */

import { and, eq, isNotNull } from 'drizzle-orm';
import { openDb } from '../src/lib/db/open';
import * as t from '../src/lib/db/schema';
import { CAMPAIGN_ID } from '../src/lib/db/seed';
import { parseWikiLinks } from '../src/lib/wiki/parse';
import { syncSessionLinks } from '../src/lib/wiki/sync-links';

async function main() {
  const apply = process.argv.includes('--apply');
  const { db, where, close } = await openDb();

  const sessions = await db
    .select({
      id: t.sessions.id,
      number: t.sessions.number,
      description: t.sessions.description,
    })
    .from(t.sessions)
    .where(and(eq(t.sessions.campaignId, CAMPAIGN_ID), isNotNull(t.sessions.description)))
    .orderBy(t.sessions.number);

  const withLinks = sessions.filter((s) => parseWikiLinks(s.description ?? '').length > 0);

  console.log(`База: ${where}.`);
  console.log(`Пересказов со ссылками: ${withLinks.length} из ${sessions.length}.`);

  if (withLinks.length === 0) {
    console.log('Пересчитывать нечего.');
    await close();
    return;
  }

  for (const session of withLinks) {
    const names = [...new Set(parseWikiLinks(session.description ?? ''))];
    console.log(`  С${session.number}: ${names.join(', ')}`);
  }

  if (!apply) {
    console.log('\nЭто предпросмотр. Чтобы применить, повторите команду с --apply.');
    await close();
    return;
  }

  let added = 0;
  const unresolved = new Set<string>();

  for (const session of withLinks) {
    const result = await syncSessionLinks(db, CAMPAIGN_ID, session.id, session.description);
    added += result.added.length;
    for (const name of result.unresolved) unresolved.add(name);
  }

  console.log(`\nГотово. Новых рёбер: ${added}.`);
  if (unresolved.size > 0) {
    console.log(
      `Без сущности остались имена: ${[...unresolved].join(', ')}. ` +
        'Заведите их на странице сессии кнопкой «создать» — или оставьте текстом.',
    );
  }

  await close();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
