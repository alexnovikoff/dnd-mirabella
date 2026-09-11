/* Правка подписи кадра в «Галерее»: что меняется вместе с ней, а что нет.
 * Хранилище и вход подменены — проверяем решения, а не запись на диск.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { runDb, setDbForTesting } from '@/lib/db/client';
import { createTestDb } from '@/lib/db/test-db';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import { FIXTURE, seedFixture } from '@/lib/db/fixture';
import * as t from '@/lib/db/schema';

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

vi.mock('@/lib/storage', () => ({
  isSupportedImage: () => true,
  saveUpload: async () => '/uploads/new.png',
  removeUpload: async () => undefined,
}));

vi.mock('@/lib/viewer', () => ({
  getViewer: async () => ({
    id: FIXTURE.users.player,
    name: 'Игрок',
    initial: 'И',
    role: 'player',
    characterSlug: 'geroy',
  }),
}));

const { renameImage } = await import('./images');

/** Кадр, заведённый быстрой записью: запись типа «фото» и есть этот кадр. */
async function seedPhotoEntry(): Promise<{ entryId: string; imageId: string }> {
  const entryId = randomUUID();
  const imageId = randomUUID();

  await runDb(async (db) => {
    await db.insert(t.entries).values({
      id: entryId,
      campaignId: CAMPAIGN_ID,
      sessionId: 's-2',
      kind: 'image',
      title: 'Кадр из шита',
      authorId: FIXTURE.users.other,
      visibility: 'public',
    });
    await db.insert(t.images).values({
      id: imageId,
      campaignId: CAMPAIGN_ID,
      sessionId: 's-2',
      entryId,
      url: '/uploads/photo.png',
      caption: 'Кадр из шита',
      uploaderId: FIXTURE.users.other,
      kind: 'art',
    });
  });

  return { entryId, imageId };
}

function caption(id: string): Promise<string | null | undefined> {
  return runDb(async (db) => {
    const [row] = await db
      .select({ caption: t.images.caption })
      .from(t.images)
      .where(eq(t.images.id, id));
    return row?.caption;
  });
}

function entryTitle(id: string): Promise<string | null | undefined> {
  return runDb(async (db) => {
    const [row] = await db
      .select({ title: t.entries.title })
      .from(t.entries)
      .where(eq(t.entries.id, id));
    return row?.title;
  });
}

beforeEach(async () => {
  const db = await createTestDb();
  await seedFixture(db);
  setDbForTesting(db);
});

afterEach(() => setDbForTesting(null));

describe('renameImage', () => {
  it('меняет подпись кадра', async () => {
    expect(await renameImage(FIXTURE.images.map, 'Карта мира')).toEqual({ ok: true });

    expect(await caption(FIXTURE.images.map)).toBe('Карта мира');
  });

  /* «Без подписи» и «подпись есть, но пустая» — разные вещи: плитка и
   * лайтбокс рисуют по null прочерк, а не пустую строку. */
  it('пустую подпись хранит как «без подписи»', async () => {
    await renameImage(FIXTURE.images.map, '   ');

    expect(await caption(FIXTURE.images.map)).toBeNull();
  });

  it('длинную подпись обрезает', async () => {
    await renameImage(FIXTURE.images.map, 'я'.repeat(300));

    expect(await caption(FIXTURE.images.map)).toHaveLength(120);
  });

  /* Запись типа «фото» и есть кадр — в ленте у неё тот же заголовок,
   * что подпись под плиткой, и расходиться им нельзя. */
  it('переписывает и запись, если кадр заводили быстрой записью', async () => {
    const { entryId, imageId } = await seedPhotoEntry();

    await renameImage(imageId, 'Вечер у костра');

    expect(await entryTitle(entryId)).toBe('Вечер у костра');
  });

  it('оставляет заголовок момента, к которому кадр только приложен', async () => {
    await renameImage(FIXTURE.images.key, 'Другая подпись');

    expect(await entryTitle(FIXTURE.entries.moment)).toBe('Момент');
  });

  /* Достижения переименовывает своё действие на странице персонажа:
   * «Галерея» их не показывает и трогать не должна. */
  it('не трогает достижения', async () => {
    expect(await renameImage(FIXTURE.images.achievement, 'Чужое')).toEqual({
      ok: false,
      error: 'Кадр уже убрали',
    });

    expect(await caption(FIXTURE.images.achievement)).toBe('Первый уровень');
  });

  it('на снятый кадр отвечает ошибкой, а не падением', async () => {
    expect(await renameImage('i-нет-такого', 'Подпись')).toEqual({
      ok: false,
      error: 'Кадр уже убрали',
    });
  });
});
