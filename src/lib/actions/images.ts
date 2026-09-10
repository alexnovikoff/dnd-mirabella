'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq, ne } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import { requireViewer } from './guard';
import { isSupportedImage, removeUpload, saveUpload } from '@/lib/storage';
import { resolveSessionId } from '@/lib/queries/sessions';

export type UploadResult = { ok: true; saved: number } | { ok: false; error: string };

export type ImageResult = { ok: true } | { ok: false; error: string };

/** Фото из шита быстрой записи: файл, подпись и одна запись под них.
 *  Отличается от uploadImages тем, что кадр приходит вместе с записью,
 *  а не отдельным перетаскиванием на «Галерею». */
export async function createPhotoEntry(
  form: FormData,
): Promise<{ ok: true; entryId: string } | { ok: false; error: string }> {
  const viewer = await requireViewer();

  const caption = String(form.get('caption') ?? '').trim();
  if (!caption) return { ok: false, error: 'Добавьте подпись к кадру' };

  const file = form.get('file');
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile && !isSupportedImage(file.type)) {
    return { ok: false, error: `Не картинка: ${file.name}` };
  }

  const publish = form.get('publish') === '1';
  /* Файл можно и не прикладывать: подпись описывает кадр, который принесут
   * позже, и плитка до тех пор рисуется штриховкой. */
  const url = hasFile ? await saveUpload(file) : null;

  const entryId = await runDb(async (db) => {
    /* Кадр уходит в сессию, выбранную в шите; по умолчанию — в активную. */
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

/** Drag-and-drop на страницу «Галерея»: файлы попадают в активную сессию. */
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

  await runDb(async (db) => {
    const sessionId = await resolveSessionId(db);

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
        /* Достижения снимает своё действие на странице персонажа: там
         * и подтверждение своё, и revalidate другой. */
        .where(and(eq(t.images.id, imageId), ne(t.images.kind, 'achievement')))
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
