/* Удаление связи и тип «без типа»: крестик в панели доски, кнопка в окне
 * типа связи и пункт «Без типа» на карточке сущности опираются на эти два
 * экшена. Вход подменён.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { runDb, setDbForTesting } from '@/lib/db/client';
import { createTestDb } from '@/lib/db/test-db';
import { FIXTURE, seedFixture } from '@/lib/db/fixture';
import * as t from '@/lib/db/schema';

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

const player = {
  id: FIXTURE.users.player,
  name: 'Игрок',
  initial: 'И',
  role: 'player',
  characterSlug: 'geroy',
};

const viewer = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('@/lib/viewer', () => ({ getViewer: async () => viewer.current }));

const { deleteLink, updateLink } = await import('./board');
const { getNodeDetail } = await import('@/lib/queries/board');

function linkById(id: string) {
  return runDb(async (db) => {
    const [row] = await db.select().from(t.links).where(eq(t.links.id, id)).limit(1);
    return row ?? null;
  });
}

beforeEach(async () => {
  const db = await createTestDb();
  await seedFixture(db);
  setDbForTesting(db);
  viewer.current = player;
});

afterEach(() => setDbForTesting(null));

describe('deleteLink', () => {
  it('убирает ручную связь, узлы остаются', async () => {
    await deleteLink('l-manual');

    expect(await linkById('l-manual')).toBeNull();
    const tavern = await getNodeDetail('taverna');
    expect(tavern?.relations).toEqual([]);
    expect(await getNodeDetail('prizrak')).not.toBeNull();
  });

  it('ребро-упоминание так не удаляется: оно выводится из текста', async () => {
    await deleteLink('l-m1');
    expect(await linkById('l-m1')).not.toBeNull();
  });

  it('без входа не удаляет', async () => {
    viewer.current = null;
    await expect(deleteLink('l-manual')).rejects.toThrow('Нужно войти');
    expect(await linkById('l-manual')).not.toBeNull();
  });
});

describe('updateLink', () => {
  it('пустой тип стирает подпись, связь остаётся', async () => {
    await updateLink('l-manual', '');

    expect(await linkById('l-manual')).toMatchObject({ kind: 'manual', label: null });
    const tavern = await getNodeDetail('taverna');
    expect(tavern?.relations).toMatchObject([{ linkId: 'l-manual', label: null }]);
  });

  it('тип из пробелов — тоже без типа', async () => {
    await updateLink('l-manual', '   ');
    expect(await linkById('l-manual')).toMatchObject({ label: null });
  });
});
