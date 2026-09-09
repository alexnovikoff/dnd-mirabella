'use server';

/* Достижения персонажа — галерея внизу его страницы.
 *
 * Кадры лежат в общей таблице images: те же загрузка, хранилище и подписи,
 * что у «Галереи». Отличают их два поля — kind = 'achievement' и nodeId,
 * которым кадр привязан к персонажу вместо сессии.
 */

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import { isSupportedImage, removeUpload, saveUpload } from '@/lib/storage';
import { requireViewer } from './guard';

export type AchievementResult = { ok: true } | { ok: false; error: string };

/** Загрузка достижений: кнопкой и перетаскиванием на блок, можно пачкой.
 *  Подпись берём из имени файла — её потом видно под плиткой. */
export async function uploadAchievements(form: FormData): Promise<AchievementResult> {
  const viewer = await requireViewer();

  const nodeId = String(form.get('nodeId') ?? '');
  const files = form
    .getAll('files')
    .filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length === 0) return { ok: false, error: 'Файлы не получены' };

  const unsupported = files.find((file) => !isSupportedImage(file.type));
  if (unsupported) return { ok: false, error: `Не картинка: ${unsupported.name}` };

  const saved: { url: string; caption: string }[] = [];
  for (const file of files) {
    saved.push({ url: await saveUpload(file), caption: file.name.replace(/\.[^.]+$/, '') });
  }

  const stored = await runDb(async (db) => {
    const [node] = await db
      .select({ id: t.nodes.id })
      .from(t.nodes)
      .where(and(eq(t.nodes.id, nodeId), eq(t.nodes.campaignId, CAMPAIGN_ID)))
      .limit(1);
    if (!node) return false;

    await db.insert(t.images).values(
      saved.map((item) => ({
        id: randomUUID(),
        campaignId: CAMPAIGN_ID,
        /* Достижение принадлежит персонажу, а не вечеру игры: сессию
         * и запись оставляем пустыми. */
        sessionId: null,
        entryId: null,
        nodeId: node.id,
        url: item.url,
        caption: item.caption,
        uploaderId: viewer.id,
        kind: 'achievement' as const,
      })),
    );
    return true;
  });

  if (!stored) {
    /* Персонажа нет — файлы уже лежат в хранилище, убираем за собой. */
    await Promise.all(saved.map((item) => removeUpload(item.url)));
    return { ok: false, error: 'Персонаж не найден' };
  }

  revalidatePath('/characters/[slug]', 'page');
  return { ok: true };
}

/** Убрать достижение. Чужое снимает только мастер — как и с записями. */
export async function deleteAchievement(imageId: string): Promise<AchievementResult> {
  const viewer = await requireViewer();

  const outcome = await runDb(
    async (
      db,
    ): Promise<
      { status: 'gone' } | { status: 'denied' } | { status: 'removed'; url: string | null }
    > => {
      const [row] = await db
        .select({ url: t.images.url, uploaderId: t.images.uploaderId })
        .from(t.images)
        .where(and(eq(t.images.id, imageId), eq(t.images.kind, 'achievement')))
        .limit(1);
      if (!row) return { status: 'gone' };
      if (viewer.role !== 'dm' && row.uploaderId !== viewer.id) return { status: 'denied' };

      await db.delete(t.images).where(eq(t.images.id, imageId));
      return { status: 'removed', url: row.url };
    },
  );

  if (outcome.status === 'gone') return { ok: false, error: 'Достижение уже убрали' };
  if (outcome.status === 'denied') return { ok: false, error: 'Это достижение загружали не вы' };

  await removeUpload(outcome.url);

  revalidatePath('/characters/[slug]', 'page');
  return { ok: true };
}
