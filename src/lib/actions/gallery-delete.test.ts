/* Снятие кадра с «Галереи»: что уходит вместе с ним, а что остаётся.
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

const fake = vi.hoisted(() => ({ removed: [] as string[] }));

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

vi.mock('@/lib/storage', () => ({
  isSupportedImage: () => true,
  saveUpload: async () => '/uploads/new.png',
  removeUpload: async (url: string | null) => {
    if (url) fake.removed.push(url);
  },
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

const { deleteImage } = await import('./images');

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

function images(): Promise<string[]> {
  return runDb(async (db) => {
    const rows = await db.select({ id: t.images.id }).from(t.images);
    return rows.map((row) => row.id);
  });
}

function entryExists(id: string): Promise<boolean> {
  return runDb(async (db) => {
    const [row] = await db.select({ id: t.entries.id }).from(t.entries).where(eq(t.entries.id, id));
    return Boolean(row);
  });
}

beforeEach(async () => {
  fake.removed = [];
  const db = await createTestDb();
  await seedFixture(db);
  setDbForTesting(db);
});

afterEach(() => setDbForTesting(null));

describe('deleteImage', () => {
  it('снимает кадр и уносит его файл', async () => {
    const { imageId } = await seedPhotoEntry();

    expect(await deleteImage(imageId)).toEqual({ ok: true });

    expect(await images()).not.toContain(imageId);
    expect(fake.removed).toEqual(['/uploads/photo.png']);
  });

  it('уносит и запись, если кадр заводили быстрой записью', async () => {
    const { entryId, imageId } = await seedPhotoEntry();

    await deleteImage(imageId);

    expect(await entryExists(entryId)).toBe(false);
  });

  it('оставляет момент, к которому кадр только приложен', async () => {
    expect(await deleteImage(FIXTURE.images.key)).toEqual({ ok: true });

    expect(await images()).not.toContain(FIXTURE.images.key);
    expect(await entryExists(FIXTURE.entries.moment)).toBe(true);
  });

  /* Достижения снимает своё действие на странице персонажа: «Галерея»
   * их не показывает и трогать не должна. */
  it('не трогает достижения', async () => {
    expect(await deleteImage(FIXTURE.images.achievement)).toEqual({
      ok: false,
      error: 'Кадр уже убрали',
    });

    expect(await images()).toContain(FIXTURE.images.achievement);
    expect(fake.removed).toEqual([]);
  });

  it('на повторное снятие отвечает ошибкой, а не падением', async () => {
    await deleteImage(FIXTURE.images.map);

    expect(await deleteImage(FIXTURE.images.map)).toEqual({
      ok: false,
      error: 'Кадр уже убрали',
    });
  });
});
