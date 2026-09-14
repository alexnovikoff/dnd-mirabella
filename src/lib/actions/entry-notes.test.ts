/* Заметка открывается на правку из базы знаний и из ленты: кто её правит
 * и что при сохранении не теряется. Вход подменён — проверяем решения.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { runDb, setDbForTesting } from '@/lib/db/client';
import { createTestDb } from '@/lib/db/test-db';
import { FIXTURE, seedFixture } from '@/lib/db/fixture';
import * as t from '@/lib/db/schema';

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

const viewer = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('@/lib/viewer', () => ({ getViewer: async () => viewer.current }));

const { deleteEntry, updateEntry } = await import('./entries');

const player = {
  id: FIXTURE.users.player,
  name: 'Игрок',
  initial: 'И',
  role: 'player',
  characterSlug: 'geroy',
};
const other = { ...player, id: FIXTURE.users.other, name: 'Другой' };

beforeEach(async () => {
  const db = await createTestDb();
  await seedFixture(db);
  setDbForTesting(db);
  viewer.current = player;
});

afterEach(() => setDbForTesting(null));

const readEntry = (id: string) =>
  runDb(async (db) => {
    const [row] = await db
      .select({
        body: t.entries.body,
        subjectId: t.entries.subjectId,
        visibility: t.entries.visibility,
      })
      .from(t.entries)
      .where(eq(t.entries.id, id));
    return row ?? null;
  });

describe('правка заметки', () => {
  it('общую заметку правит и удаляет любой вошедший, а не только автор', async () => {
    await runDb((db) =>
      db.insert(t.entries).values({
        id: 'e-public-note',
        campaignId: FIXTURE.campaignId,
        kind: 'note',
        body: 'Общая заметка.',
        authorId: FIXTURE.users.player,
        visibility: 'public',
      }),
    );
    viewer.current = other;

    const result = await updateEntry('e-public-note', { body: 'Поправлено.', publish: true });
    expect(result.ok).toBe(true);
    expect((await readEntry('e-public-note'))?.body).toBe('Поправлено.');

    expect(await deleteEntry('e-public-note')).toEqual({ ok: true });
    expect(await readEntry('e-public-note')).toBeNull();
  });

  it('личная заметка о персонаже после правки остаётся при персонаже', async () => {
    await runDb((db) =>
      db
        .update(t.entries)
        .set({ subjectId: FIXTURE.nodes.hero })
        .where(eq(t.entries.id, FIXTURE.entries.privateNote)),
    );

    /* Шит шлёт автора только цитате: у заметки такого поля в форме нет. */
    const result = await updateEntry(FIXTURE.entries.privateNote, {
      body: 'Личное, дополнено.',
      publish: true,
    });

    expect(result.ok).toBe(true);
    expect(await readEntry(FIXTURE.entries.privateNote)).toEqual({
      body: 'Личное, дополнено.',
      subjectId: FIXTURE.nodes.hero,
      visibility: 'private',
    });
  });
});
