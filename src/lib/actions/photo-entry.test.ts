/* Шит быстрой записи: что обязательно у кадра, а что нет, и куда уходит
 * запись при выборе сессии — включая пустой пункт списка.
 * Хранилище и вход подменены — проверяем решения, а не запись на диск.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { runDb, setDbForTesting } from '@/lib/db/client';
import { createTestDb } from '@/lib/db/test-db';
import { seedFixture, FIXTURE } from '@/lib/db/fixture';
import { NO_SESSION } from '@/lib/sessions-shared';
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

const { createPhotoEntry, uploadImages } = await import('./images');
const { createEntry, updateEntry } = await import('./entries');

function photo(fields: { caption?: string; sessionId?: string; file?: boolean }): FormData {
  const form = new FormData();
  form.append('caption', fields.caption ?? '');
  form.append('publish', '1');
  if (fields.sessionId !== undefined) form.append('sessionId', fields.sessionId);
  if (fields.file !== false) {
    form.append('file', new File(['кадр'], 'photo.png', { type: 'image/png' }));
  }
  return form;
}

/** Кадр и его запись — то, ради чего действие и вызывают. */
function saved(entryId: string) {
  return runDb(async (db) => {
    const [entry] = await db
      .select({ title: t.entries.title, sessionId: t.entries.sessionId })
      .from(t.entries)
      .where(eq(t.entries.id, entryId));
    const [image] = await db
      .select({ caption: t.images.caption, url: t.images.url, sessionId: t.images.sessionId })
      .from(t.images)
      .where(eq(t.images.entryId, entryId));
    return { entry, image };
  });
}

beforeEach(async () => {
  const db = await createTestDb();
  await seedFixture(db);
  setDbForTesting(db);
});

afterEach(() => setDbForTesting(null));

describe('createPhotoEntry', () => {
  it('берёт кадр без подписи: файл говорит сам за себя', async () => {
    const result = await createPhotoEntry(photo({}));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { entry, image } = await saved(result.entryId);
    expect(image.caption).toBeNull();
    expect(image.url).toBe('/uploads/new.png');
    expect(entry.title).toBeNull();
  });

  it('без файла и без подписи отказывает: показывать было бы нечего', async () => {
    expect(await createPhotoEntry(photo({ file: false }))).toEqual({
      ok: false,
      error: 'Приложите файл или добавьте подпись',
    });
  });

  it('берёт подпись без файла: кадр принесут позже', async () => {
    const result = await createPhotoEntry(photo({ caption: 'Карта порта', file: false }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { image } = await saved(result.entryId);
    expect(image.url).toBeNull();
    expect(image.caption).toBe('Карта порта');
  });

  it('оставляет кадр вне сессий, если выбрали «Без сессии»', async () => {
    const result = await createPhotoEntry(photo({ sessionId: NO_SESSION }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { entry, image } = await saved(result.entryId);
    expect(entry.sessionId).toBeNull();
    expect(image.sessionId).toBeNull();
  });

  /* Выбора не делали — кадр уходит в игру, которую сейчас играют. */
  it('без выбора кладёт кадр в активную сессию', async () => {
    const result = await createPhotoEntry(photo({}));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect((await saved(result.entryId)).image.sessionId).toBe('s-2');
  });
});

describe('uploadImages', () => {
  function dropped(sessionId?: string): FormData {
    const form = new FormData();
    form.append('files', new File(['кадр'], 'photo.png', { type: 'image/png' }));
    if (sessionId !== undefined) form.append('sessionId', sessionId);
    return form;
  }

  function bare() {
    return runDb(async (db) => {
      const rows = await db
        .select({ sessionId: t.images.sessionId, caption: t.images.caption })
        .from(t.images)
        .where(eq(t.images.url, '/uploads/new.png'));
      return rows;
    });
  }

  it('кладёт брошенные файлы в активную сессию', async () => {
    expect(await uploadImages(dropped())).toEqual({ ok: true, saved: 1 });
    expect((await bare())[0]?.sessionId).toBe('s-2');
  });

  it('оставляет их вне сессий, если так выбрали на полосе', async () => {
    expect(await uploadImages(dropped(NO_SESSION))).toEqual({ ok: true, saved: 1 });
    expect((await bare())[0]?.sessionId).toBeNull();
  });
});

/* Пустой пункт в списке сессий доступен любой записи, не только кадру. */
describe('createEntry вне сессий', () => {
  function entrySessionId(entryId: string) {
    return runDb(async (db) => {
      const [row] = await db
        .select({ sessionId: t.entries.sessionId })
        .from(t.entries)
        .where(eq(t.entries.id, entryId));
      return row?.sessionId ?? null;
    });
  }

  it('оставляет момент вне сессий, если поле оставили пустым', async () => {
    const result = await createEntry({
      kind: 'moment',
      body: 'Мысль между играми',
      sessionId: NO_SESSION,
      publish: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(await entrySessionId(result.entryId)).toBeNull();
  });

  it('без выбора всё так же кладёт запись в активную сессию', async () => {
    const result = await createEntry({ kind: 'moment', body: 'За столом', publish: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(await entrySessionId(result.entryId)).toBe('s-2');
  });
});

describe('updateEntry для фото', () => {
  async function existing(withFile: boolean): Promise<string> {
    const result = await createPhotoEntry(photo({ caption: 'Первая подпись', file: withFile }));
    if (!result.ok) throw new Error(result.error);
    return result.entryId;
  }

  it('позволяет стереть подпись у загруженного кадра', async () => {
    const entryId = await existing(true);

    const result = await updateEntry(entryId, { body: '', caption: '', publish: true });
    expect(result.ok).toBe(true);

    const { entry, image } = await saved(entryId);
    expect(image.caption).toBeNull();
    expect(entry.title).toBeNull();
  });

  it('не даёт стереть подпись, пока кадра нет', async () => {
    const entryId = await existing(false);

    expect(await updateEntry(entryId, { body: '', caption: '', publish: true })).toEqual({
      ok: false,
      error: 'Приложите файл или добавьте подпись',
    });
    expect((await saved(entryId)).image.caption).toBe('Первая подпись');
  });

  it('уносит запись и её кадр из сессий по выбору «Без сессии»', async () => {
    const entryId = await existing(true);

    const result = await updateEntry(entryId, {
      body: '',
      caption: 'Первая подпись',
      sessionId: NO_SESSION,
      publish: true,
    });
    expect(result.ok).toBe(true);

    const { entry, image } = await saved(entryId);
    expect(entry.sessionId).toBeNull();
    expect(image.sessionId).toBeNull();
  });
});
