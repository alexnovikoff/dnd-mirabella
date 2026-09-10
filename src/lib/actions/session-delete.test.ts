/* Удаление сессии: что уходит вместе с игрой, а что остаётся.
 * Вход подменён — проверяем решения, а не сессию next-auth.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { runDb, setDbForTesting } from '@/lib/db/client';
import { createTestDb } from '@/lib/db/test-db';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import { FIXTURE, seedFixture } from '@/lib/db/fixture';
import * as t from '@/lib/db/schema';

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

const viewer = vi.hoisted(() => ({
  current: {
    id: 'u-test-player',
    name: 'Игрок',
    initial: 'И',
    role: 'player',
    characterSlug: 'geroy',
  } as unknown,
}));

vi.mock('@/lib/viewer', () => ({ getViewer: async () => viewer.current }));

const { createSession, deleteSession } = await import('./sessions');

beforeEach(async () => {
  const db = await createTestDb();
  await seedFixture(db);
  setDbForTesting(db);
  viewer.current = {
    id: FIXTURE.users.player,
    name: 'Игрок',
    initial: 'И',
    role: 'player',
    characterSlug: 'geroy',
  };
});

afterEach(() => setDbForTesting(null));

const numbers = () =>
  runDb(async (db) => {
    const rows = await db
      .select({ number: t.sessions.number })
      .from(t.sessions)
      .where(eq(t.sessions.campaignId, CAMPAIGN_ID));
    return rows.map((row) => row.number).sort((a, b) => a - b);
  });

describe('deleteSession', () => {
  it('убирает игру из списка сессий', async () => {
    expect(await deleteSession(1)).toEqual({ ok: true, number: 1 });
    expect(await numbers()).toEqual([2]);
  });

  it('оставляет записи и кадры игры, но уже вне сессий', async () => {
    await deleteSession(1);

    const orphans = await runDb(async (db) => {
      const [entry] = await db
        .select({ id: t.entries.id, sessionId: t.entries.sessionId })
        .from(t.entries)
        .where(eq(t.entries.id, FIXTURE.entries.fail));
      const [image] = await db
        .select({ id: t.images.id, sessionId: t.images.sessionId })
        .from(t.images)
        .where(eq(t.images.id, FIXTURE.images.map));
      return { entry, image };
    });

    expect(orphans.entry).toEqual({ id: FIXTURE.entries.fail, sessionId: null });
    expect(orphans.image).toEqual({ id: FIXTURE.images.map, sessionId: null });
  });

  it('не трогает соседнюю игру', async () => {
    await deleteSession(1);

    const kept = await runDb((db) =>
      db.select({ id: t.entries.id }).from(t.entries).where(eq(t.entries.sessionId, 's-2')),
    );
    expect(kept.length).toBeGreaterThan(0);
  });

  it('не пересчитывает номера: следующая игра получает свой', async () => {
    await deleteSession(1);

    expect(await createSession()).toEqual({ ok: true, number: 3 });
    expect(await numbers()).toEqual([2, 3]);
  });

  it('о несуществующей игре сообщает, а не молчит', async () => {
    expect(await deleteSession(99)).toEqual({ ok: false, error: 'Сессия не найдена' });
    expect(await numbers()).toEqual([1, 2]);
  });

  it('разлогиненному не даёт удалить', async () => {
    viewer.current = null;

    await expect(deleteSession(1)).rejects.toThrow();
    expect(await numbers()).toEqual([1, 2]);
  });
});
