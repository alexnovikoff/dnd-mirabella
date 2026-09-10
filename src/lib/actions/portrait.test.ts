/* Файловая часть портрета: какие адреса остаются в базе и какие файлы
 * после этого удаляются. Хранилище и вход подменены — проверяем решения,
 * а не запись на диск.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { runDb, setDbForTesting } from '@/lib/db/client';
import { createTestDb } from '@/lib/db/test-db';
import { FIXTURE, seedFixture } from '@/lib/db/fixture';
import * as t from '@/lib/db/schema';

const fake = vi.hoisted(() => ({ saved: 0, removed: [] as string[] }));

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

vi.mock('@/lib/storage', () => ({
  isSupportedImage: (type: string) => type === 'image/png',
  saveUpload: async () => `/uploads/${++fake.saved}.png`,
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

const { deletePortrait, savePortraitCrop, uploadPortrait } = await import('./characters');

const HERO = FIXTURE.nodes.hero;
const CROP = { x: 0.1, y: 0.2, w: 0.5, h: 0.6 };

function picture() {
  return new File([new Uint8Array([1, 2, 3])], 'p.png', { type: 'image/png' });
}

function form(fields: Record<string, string | File>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

function read() {
  return runDb(async (db) => {
    const [row] = await db
      .select({
        portrait: t.characters.portrait,
        portraitSource: t.characters.portraitSource,
        portraitCrop: t.characters.portraitCrop,
      })
      .from(t.characters)
      .where(eq(t.characters.nodeId, HERO))
      .limit(1);
    return row;
  });
}

beforeEach(async () => {
  fake.saved = 0;
  fake.removed = [];
  const db = await createTestDb();
  await seedFixture(db);
  setDbForTesting(db);
});

afterEach(() => setDbForTesting(null));

describe('uploadPortrait', () => {
  it('кладёт файл и портретом, и оригиналом', async () => {
    await uploadPortrait(form({ nodeId: HERO, file: picture() }));

    expect(await read()).toEqual({
      portrait: '/uploads/1.png',
      portraitSource: '/uploads/1.png',
      portraitCrop: null,
    });
    expect(fake.removed).toEqual([]);
  });

  it('замена уносит и прошлый кадр, и прошлый оригинал', async () => {
    await uploadPortrait(form({ nodeId: HERO, file: picture() }));
    await savePortraitCrop(form({ nodeId: HERO, file: picture(), crop: JSON.stringify(CROP) }));
    fake.removed = [];

    await uploadPortrait(form({ nodeId: HERO, file: picture() }));

    expect(fake.removed.sort()).toEqual(['/uploads/1.png', '/uploads/2.png']);
    expect(await read()).toEqual({
      portrait: '/uploads/3.png',
      portraitSource: '/uploads/3.png',
      portraitCrop: null,
    });
  });

  it('не трогает базу, когда персонажа нет', async () => {
    expect(await uploadPortrait(form({ nodeId: 'n-нет', file: picture() }))).toEqual({
      ok: false,
      error: 'Персонаж не найден',
    });
    /* Файл успели записать — значит, надо и убрать. */
    expect(fake.removed).toEqual(['/uploads/1.png']);
  });
});

describe('savePortraitCrop', () => {
  beforeEach(async () => {
    await uploadPortrait(form({ nodeId: HERO, file: picture() }));
    fake.removed = [];
  });

  it('меняет портрет на кадр, оригинал оставляет', async () => {
    expect(
      await savePortraitCrop(form({ nodeId: HERO, file: picture(), crop: JSON.stringify(CROP) })),
    ).toEqual({ ok: true });

    expect(await read()).toEqual({
      portrait: '/uploads/2.png',
      portraitSource: '/uploads/1.png',
      portraitCrop: CROP,
    });
    expect(fake.removed).toEqual([]);
  });

  it('повторный кадр режет оригинал, а не прошлый кадр', async () => {
    await savePortraitCrop(form({ nodeId: HERO, file: picture(), crop: JSON.stringify(CROP) }));
    await savePortraitCrop(
      form({ nodeId: HERO, file: picture(), crop: JSON.stringify({ x: 0, y: 0, w: 1, h: 1 }) }),
    );

    expect(await read()).toEqual({
      portrait: '/uploads/3.png',
      portraitSource: '/uploads/1.png',
      portraitCrop: { x: 0, y: 0, w: 1, h: 1 },
    });
    /* Ушёл только промежуточный кадр. */
    expect(fake.removed).toEqual(['/uploads/2.png']);
  });

  it('портрет из времён без колонки становится собственным оригиналом', async () => {
    await runDb((db) =>
      db.update(t.characters).set({ portraitSource: null }).where(eq(t.characters.nodeId, HERO)),
    );

    await savePortraitCrop(form({ nodeId: HERO, file: picture(), crop: JSON.stringify(CROP) }));

    expect(await read()).toEqual({
      portrait: '/uploads/2.png',
      portraitSource: '/uploads/1.png',
      portraitCrop: CROP,
    });
    expect(fake.removed).toEqual([]);
  });

  it('без внятной рамки не сохраняет и файл не пишет', async () => {
    expect(
      await savePortraitCrop(form({ nodeId: HERO, file: picture(), crop: 'не json' })),
    ).toEqual({ ok: false, error: 'Рамка кадра не задана' });

    expect(fake.saved).toBe(1);
    expect((await read())?.portrait).toBe('/uploads/1.png');
  });
});

describe('deletePortrait', () => {
  it('уносит и кадр, и оригинал', async () => {
    await uploadPortrait(form({ nodeId: HERO, file: picture() }));
    await savePortraitCrop(form({ nodeId: HERO, file: picture(), crop: JSON.stringify(CROP) }));
    fake.removed = [];

    expect(await deletePortrait(HERO)).toEqual({ ok: true });

    expect(await read()).toEqual({ portrait: null, portraitSource: null, portraitCrop: null });
    expect(fake.removed.sort()).toEqual(['/uploads/1.png', '/uploads/2.png']);
  });
});
