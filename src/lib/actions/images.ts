'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { desc, eq } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import { requireViewer } from './guard';
import { isSupportedImage, saveUpload } from '@/lib/storage';

export type UploadResult = { ok: true; saved: number } | { ok: false; error: string };

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
    const [session] = await db
      .select({ id: t.sessions.id })
      .from(t.sessions)
      .where(eq(t.sessions.campaignId, CAMPAIGN_ID))
      .orderBy(desc(t.sessions.number))
      .limit(1);

    const id = randomUUID();
    await db.insert(t.entries).values({
      id,
      campaignId: CAMPAIGN_ID,
      sessionId: session?.id ?? null,
      kind: 'image',
      title: caption,
      body: null,
      authorId: viewer.id,
      visibility: publish ? 'public' : 'draft',
    });

    await db.insert(t.images).values({
      id: randomUUID(),
      campaignId: CAMPAIGN_ID,
      sessionId: session?.id ?? null,
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
    const [session] = await db
      .select({ id: t.sessions.id })
      .from(t.sessions)
      .where(eq(t.sessions.campaignId, CAMPAIGN_ID))
      .orderBy(desc(t.sessions.number))
      .limit(1);

    await db.insert(t.images).values(
      urls.map((item) => ({
        id: randomUUID(),
        campaignId: CAMPAIGN_ID,
        sessionId: session?.id ?? null,
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
