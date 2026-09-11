/* Кадры карточки сущности: что попадает в базу, что уходит из хранилища
 * и как эти кадры уживаются с «Галереей» и достижениями. Хранилище и вход
 * подменены — проверяем решения, а не запись на диск.
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

const { deleteEntityImage, uploadEntityImages } = await import('./entity-images');
const { deleteImage, renameImage } = await import('./images');
const { getNodeDetail } = await import('@/lib/queries/board');
const { getGallery } = await import('@/lib/queries/gallery');

/** Призрак — NPC из фикстуры, его карточка и есть карточка NPC. */
const GHOST = FIXTURE.nodes.ghost;

function picture(name = 'p.png', type = 'image/png') {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

function form(nodeId: string, ...files: File[]): FormData {
  const data = new FormData();
  data.append('nodeId', nodeId);
  for (const file of files) data.append('files', file);
  return data;
}

function stored() {
  return runDb((db) =>
    db
      .select({
        id: t.images.id,
        url: t.images.url,
        caption: t.images.caption,
        kind: t.images.kind,
      })
      .from(t.images)
      .where(eq(t.images.nodeId, GHOST)),
  );
}

beforeEach(async () => {
  fake.saved = 0;
  fake.removed = [];
  const db = await createTestDb();
  await seedFixture(db);
  setDbForTesting(db);
});

afterEach(() => setDbForTesting(null));

describe('uploadEntityImages', () => {
  it('кладёт кадры на карточку и подписывает их именем файла', async () => {
    expect(await uploadEntityImages(form(GHOST, picture('Портрет.png')))).toEqual({ ok: true });

    expect(await stored()).toEqual([
      { id: expect.any(String), url: '/uploads/1.png', caption: 'Портрет', kind: 'entity' },
    ]);
  });

  it('берёт пачку файлов за раз', async () => {
    await uploadEntityImages(form(GHOST, picture('один.png'), picture('два.png')));

    expect((await stored()).map((row) => row.caption).sort()).toEqual(['два', 'один']);
  });

  it('не пишет ни файла, ни строки, если среди файлов не картинка', async () => {
    expect(await uploadEntityImages(form(GHOST, picture('текст.txt', 'text/plain')))).toEqual({
      ok: false,
      error: 'Не картинка: текст.txt',
    });

    expect(fake.saved).toBe(0);
    expect(await stored()).toEqual([]);
  });

  it('без файлов ничего не делает', async () => {
    expect(await uploadEntityImages(form(GHOST))).toEqual({
      ok: false,
      error: 'Файлы не получены',
    });
  });

  it('убирает за собой файл, когда сущности нет', async () => {
    expect(await uploadEntityImages(form('n-нет', picture()))).toEqual({
      ok: false,
      error: 'Сущность не найдена',
    });

    expect(fake.removed).toEqual(['/uploads/1.png']);
  });
});

describe('deleteEntityImage', () => {
  it('снимает кадр и уносит файл из хранилища', async () => {
    await uploadEntityImages(form(GHOST, picture()));
    const [image] = await stored();

    expect(await deleteEntityImage(image.id)).toEqual({ ok: true });

    expect(await stored()).toEqual([]);
    expect(fake.removed).toEqual(['/uploads/1.png']);
  });

  it('второй раз честно говорит, что кадра уже нет', async () => {
    await uploadEntityImages(form(GHOST, picture()));
    const [image] = await stored();
    await deleteEntityImage(image.id);
    fake.removed = [];

    expect(await deleteEntityImage(image.id)).toEqual({ ok: false, error: 'Кадр уже убрали' });
    expect(fake.removed).toEqual([]);
  });

  it('не трогает достижение персонажа — у него своё действие', async () => {
    expect(await deleteEntityImage(FIXTURE.images.achievement)).toEqual({
      ok: false,
      error: 'Кадр уже убрали',
    });

    const rows = await runDb((db) =>
      db
        .select({ id: t.images.id })
        .from(t.images)
        .where(eq(t.images.id, FIXTURE.images.achievement)),
    );
    expect(rows).toHaveLength(1);
  });
});

describe('кадр карточки живёт отдельно от «Галереи»', () => {
  beforeEach(async () => {
    await uploadEntityImages(form(GHOST, picture('Портрет.png')));
  });

  it('в ленту «Галереи» не попадает', async () => {
    const gallery = await getGallery('all', false);
    const captions = gallery.groups.flatMap((group) => group.images.map((image) => image.caption));

    expect(captions).not.toContain('Портрет');
  });

  it('действия «Галереи» его не снимают и не переподписывают', async () => {
    const [image] = await stored();

    expect(await deleteImage(image.id)).toEqual({ ok: false, error: 'Кадр уже убрали' });
    expect(await renameImage(image.id, 'Чужое')).toEqual({ ok: false, error: 'Кадр уже убрали' });
    expect((await stored())[0]).toMatchObject({ caption: 'Портрет' });
  });

  it('виден на самой карточке', async () => {
    const detail = await getNodeDetail('prizrak');

    expect(detail?.images).toEqual([
      {
        id: expect.any(String),
        url: '/uploads/1.png',
        caption: 'Портрет',
        uploaderName: 'Игрок',
      },
    ]);
  });
});
