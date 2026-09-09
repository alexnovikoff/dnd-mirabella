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
