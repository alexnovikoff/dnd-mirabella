'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq, notInArray } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import { requireViewer } from './guard';
import { isSupportedImage, removeUpload, saveUpload } from '@/lib/storage';
import { resolveSessionId } from '@/lib/queries/sessions';

export type UploadResult = { ok: true; saved: number } | { ok: false; error: string };

export type ImageResult = { ok: true } | { ok: false; error: string };

/* Подпись живёт одной-двумя строками под плиткой: длиннее её всё равно
 * не прочитать. То же число стоит в maxLength поля правки — и у достижений,
 * которые лежат в той же таблице. */
const CAPTION_LIMIT = 120;

/** Фото из шита быстрой записи: файл, подпись и одна запись под них.
 *  Отличается от uploadImages тем, что кадр приходит вместе с записью,
 *  а не отдельным перетаскиванием на «Галерею». */
export async function createPhotoEntry(
  form: FormData,
): Promise<{ ok: true; entryId: string } | { ok: false; error: string }> {
  const viewer = await requireViewer();

  /* Подпись необязательна: кадр говорит сам за себя чаще, чем его подписывают.
   * Пустую храним как null, а не пустой строкой, — «Галерея» и лайтбокс
   * различают «без подписи» и «подпись есть, но пустая». */
  const caption = String(form.get('caption') ?? '').trim() || null;

  const file = form.get('file');
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile && !isSupportedImage(file.type)) {
    return { ok: false, error: `Не картинка: ${file.name}` };
  }

  /* Одно из двух быть обязано: иначе в хронику уходит пустая карточка. */
  if (!hasFile && !caption) {
    return { ok: false, error: 'Приложите файл или добавьте подпись' };
  }

  const publish = form.get('publish') === '1';
  /* Файл можно и не прикладывать: подпись описывает кадр, который принесут
   * позже, и плитка до тех пор рисуется штриховкой. */
  const url = hasFile ? await saveUpload(file) : null;

  const entryId = await runDb(async (db) => {
    /* Кадр уходит в сессию, выбранную в шите; по умолчанию — в активную.
     * NO_SESSION в селекте оставляет кадр вне игр — арт персонажа или карта
     * мира не относятся ни к одному вечеру за столом. */
    const sessionId = await resolveSessionId(db, String(form.get('sessionId') ?? '') || null);

    const id = randomUUID();
    await db.insert(t.entries).values({
      id,
      campaignId: CAMPAIGN_ID,
      sessionId,
      kind: 'image',
      title: caption,
      body: null,
      authorId: viewer.id,
      visibility: publish ? 'public' : 'draft',
    });

    await db.insert(t.images).values({
      id: randomUUID(),
      campaignId: CAMPAIGN_ID,
      sessionId,
      entryId: id,
      url,
      caption,
      uploaderId: viewer.id,
      kind: 'art',
    });

    return id;
  });

  revalidatePath('/');
  revalidatePath('/gallery');
  return { ok: true, entryId };
}

/** Drag-and-drop на страницу «Галерея»: файлы попадают в активную сессию,
 *  либо — если на полосе выбрали «Без сессии» — вне игр вообще. */
export async function uploadImages(form: FormData): Promise<UploadResult> {
  const viewer = await requireViewer();
  const files = form.getAll('files').filter((item): item is File => item instanceof File);
  if (files.length === 0) return { ok: false, error: 'Файлы не получены' };

  const unsupported = files.find((file) => !isSupportedImage(file.type));
  if (unsupported) {
    return { ok: false, error: `Не картинка: ${unsupported.name}` };
  }

  const urls: { url: string; caption: string }[] = [];
  for (const file of files) {
    urls.push({ url: await saveUpload(file), caption: file.name.replace(/\.[^.]+$/, '') });
  }

  const target = String(form.get('sessionId') ?? '') || null;

  await runDb(async (db) => {
    const sessionId = await resolveSessionId(db, target);

    await db.insert(t.images).values(
      urls.map((item) => ({
        id: randomUUID(),
        campaignId: CAMPAIGN_ID,
        sessionId,
        entryId: null,
        url: item.url,
        caption: item.caption,
        uploaderId: viewer.id,
        kind: 'art' as const,
      })),
    );
  });

  revalidatePath('/gallery');
  revalidatePath('/');
  return { ok: true, saved: files.length };
}

/** Убрать кадр из «Галереи». Права те же, что у достижений: галерею
 *  собирают вместе, и снять чужой кадр может любой вошедший.
 *
 *  Запись типа «фото» уходит вместе с кадром — она и есть кадр, ровно так же
 *  deleteEntry уносит картинку следом за записью. Кадр, приложенный к моменту,
 *  забирает с собой только себя: момент остаётся в хронике. */
export async function deleteImage(imageId: string): Promise<ImageResult> {
  await requireViewer();

  const outcome = await runDb(
    async (db): Promise<{ status: 'gone' } | { status: 'removed'; url: string | null }> => {
      const [row] = await db
        .select({ url: t.images.url, entryId: t.images.entryId, entryKind: t.entries.kind })
        .from(t.images)
        .leftJoin(t.entries, eq(t.entries.id, t.images.entryId))
        /* Кадры узлов снимают свои действия — на странице персонажа
         * и на карточке сущности: там и подтверждение своё, и revalidate
         * другой. */
        .where(and(eq(t.images.id, imageId), notInArray(t.images.kind, t.NODE_IMAGE_KINDS)))
        .limit(1);
      if (!row) return { status: 'gone' };

      await db.delete(t.images).where(eq(t.images.id, imageId));
      if (row.entryId && row.entryKind === 'image') {
        await db.delete(t.entries).where(eq(t.entries.id, row.entryId));
      }

      return { status: 'removed', url: row.url };
    },
  );

  if (outcome.status === 'gone') return { ok: false, error: 'Кадр уже убрали' };

  await removeUpload(outcome.url);

  revalidatePath('/');
  revalidatePath('/gallery');
  revalidatePath('/sessions/[number]', 'page');
  return { ok: true };
}

/** Переписать подпись кадра. Права те же, что на снятие: галерею собирают
 *  вместе, и подпись чужого кадра правит любой вошедший. Править есть что:
 *  перетащенному файлу подпись достаётся от его имени, а «IMG_2043»
 *  под плиткой не рассказывает ничего.
 *
 *  Запись типа «фото» — это и есть кадр (ровно поэтому deleteImage уносит её
 *  следом), и заголовок в ленте у неё тот же, что подпись под плиткой:
 *  расходиться им нельзя. Момент, к которому кадр только приложен, живёт
 *  своей жизнью — его заголовок остаётся как был.
 */
export async function renameImage(imageId: string, caption: string): Promise<ImageResult> {
  await requireViewer();

  /* Пустая подпись — это «без подписи», а не пустая строка: «Галерея»
   * и лайтбокс различают их. */
  const next = caption.trim().slice(0, CAPTION_LIMIT) || null;

  const outcome = await runDb(async (db): Promise<'gone' | 'renamed'> => {
    const [row] = await db
      .select({ entryId: t.images.entryId, entryKind: t.entries.kind })
      .from(t.images)
      .leftJoin(t.entries, eq(t.entries.id, t.images.entryId))
      /* Кадры узлов переименовывают свои действия — на странице персонажа
       * и на карточке сущности: там и подпись своя, и revalidate другой. */
      .where(and(eq(t.images.id, imageId), notInArray(t.images.kind, t.NODE_IMAGE_KINDS)))
      .limit(1);
    if (!row) return 'gone';

    await db.update(t.images).set({ caption: next }).where(eq(t.images.id, imageId));
    if (row.entryId && row.entryKind === 'image') {
      await db.update(t.entries).set({ title: next }).where(eq(t.entries.id, row.entryId));
    }

    return 'renamed';
  });

  if (outcome === 'gone') return { ok: false, error: 'Кадр уже убрали' };

  revalidatePath('/');
  revalidatePath('/gallery');
  revalidatePath('/sessions/[number]', 'page');
  return { ok: true };
}
