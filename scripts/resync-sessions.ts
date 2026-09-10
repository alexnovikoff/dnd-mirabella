/* Одноразовая правка боевой базы: привести сессии к текущему сиду.
 *
 *   DATABASE_URL='<строка Neon>' pnpm db:resync-sessions            показать, что изменится
 *   DATABASE_URL='<строка Neon>' pnpm db:resync-sessions --apply    применить
 *
 * Сид накатывается только на пустую базу, поэтому боевая осталась с прежними
 * данными: придуманные моменты и заметки, подписи несуществующих кадров,
 * посчитанные формулой даты и сессии без названий. Скрипт делает с ними ровно
 * то, что теперь делает сид:
 *   — сносит заглушки по их id — всё, что записали игроки, остаётся на месте;
 *   — чистит даты у засеянных сессий;
 *   — проставляет заголовки.
 *
 * Рёбра-упоминания удалённых записей уходят сами: внешний ключ с on delete
 * cascade. После того как боевая база приведена в порядок, файл можно удалить.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { openDb } from '../src/lib/db/open';
import * as t from '../src/lib/db/schema';
import { CAMPAIGN_ID, SESSION_COUNT, SESSION_TITLES } from '../src/lib/db/seed';

/** Id заглушек прежнего сида — больше их взять неоткуда, в сиде их уже нет. */
const STUB_ENTRIES = [
  'e-24-2',
  'e-25-1',
  'e-25-2',
  'e-25-note',
  'e-26-1',
  'e-26-note',
  'e-26-private',
];

const STUB_IMAGES = ['i-1', 'i-2', 'i-3', 'i-4', 'i-5', 'i-6', 'i-7', 'i-8'];

const SEEDED_SESSIONS = Array.from({ length: SESSION_COUNT }, (_, i) => `s-${i + 1}`);

async function main() {
  const apply = process.argv.includes('--apply');
  const { db, where, close } = await openDb();

  const entries = await db
    .select({ id: t.entries.id, kind: t.entries.kind, title: t.entries.title })
    .from(t.entries)
    .where(and(eq(t.entries.campaignId, CAMPAIGN_ID), inArray(t.entries.id, STUB_ENTRIES)));

  const images = await db
    .select({ id: t.images.id, caption: t.images.caption })
    .from(t.images)
    .where(and(eq(t.images.campaignId, CAMPAIGN_ID), inArray(t.images.id, STUB_IMAGES)));

  const sessions = await db
    .select({
      id: t.sessions.id,
      number: t.sessions.number,
      title: t.sessions.title,
      date: t.sessions.date,
    })
    .from(t.sessions)
    .where(and(eq(t.sessions.campaignId, CAMPAIGN_ID), inArray(t.sessions.id, SEEDED_SESSIONS)))
    .orderBy(t.sessions.number);

  if (sessions.length === 0) {
    console.log(
      `Сессий кампании в базе нет (${where}). Похоже, она ещё не засеяна — тогда нужен не этот скрипт, а pnpm db:setup.`,
    );
    await close();
    return;
  }

  /* Что именно поменяется — считаем до записи, чтобы то же самое можно было
   * сперва просто показать. */
  const retitle = sessions.filter((s) => (SESSION_TITLES[s.number] ?? null) !== s.title);
  const undate = sessions.filter((s) => s.date !== null);

  console.log(`База: ${where}`);
  console.log(`Записей-заглушек: ${entries.length}`);
  for (const entry of entries)
    console.log(`  − ${entry.id} · ${entry.kind} · ${entry.title ?? ''}`);
  console.log(`Кадров-заглушек: ${images.length}`);
  for (const image of images) console.log(`  − ${image.id} · ${image.caption ?? ''}`);
  console.log(`Дат к очистке: ${undate.length}`);
  for (const s of undate) console.log(`  − С${s.number} · ${s.date}`);
  console.log(`Заголовков к простановке: ${retitle.length}`);
  for (const s of retitle)
    console.log(`  + С${s.number} · ${SESSION_TITLES[s.number] ?? '(пусто)'}`);

  if (entries.length + images.length + undate.length + retitle.length === 0) {
    console.log('Менять нечего — боевая база уже совпадает с сидом.');
    await close();
    return;
  }

  if (!apply) {
    console.log('\nЭто предпросмотр. Чтобы применить, повторите команду с --apply.');
    await close();
    return;
  }

  if (entries.length > 0) {
    await db.delete(t.entries).where(
      inArray(
        t.entries.id,
        entries.map((e) => e.id),
      ),
    );
  }
  if (images.length > 0) {
    await db.delete(t.images).where(
      inArray(
        t.images.id,
        images.map((i) => i.id),
      ),
    );
  }

  /* По сессии за раз: строк 26, а условие у каждой своё. */
  for (const session of sessions) {
    const title = SESSION_TITLES[session.number] ?? null;
    if (title === session.title && session.date === null) continue;
    await db.update(t.sessions).set({ title, date: null }).where(eq(t.sessions.id, session.id));
  }

  console.log('\nГотово.');
  await close();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
