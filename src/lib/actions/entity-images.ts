'use server';

/* Кадры на карточке сущности — NPC, локация, фракция, артефакт.
 *
 * Устроены как достижения персонажа: те же загрузка, хранилище и таблица
 * images, привязка к узлу через nodeId. Отличает их kind = 'entity' —
 * по нему кадр не попадает ни в «Галерею», ни в блок достижений.
 */

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import { isSupportedImage, removeUpload, saveUpload } from '@/lib/storage';
import { requireViewer } from './guard';

export type EntityImageResult = { ok: true } | { ok: false; error: string };

/* Подпись живёт одной строкой под плиткой — та же мерка, что у достижений
 * и у «Галереи». */
const CAPTION_LIMIT = 120;

/** Загрузка кадров на карточку: кнопкой и перетаскиванием на блок, пачкой.
 *  Подпись берём из имени файла — её видно под плиткой. */
export async function uploadEntityImages(form: FormData): Promise<EntityImageResult> {
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
    saved.push({
      url: await saveUpload(file),
      caption: file.name.replace(/\.[^.]+$/, '').slice(0, CAPTION_LIMIT),
    });
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
        /* Кадр принадлежит сущности, а не вечеру игры: сессию и запись
         * оставляем пустыми — ровно как у достижений. */
        sessionId: null,
        entryId: null,
        nodeId: node.id,
        url: item.url,
        caption: item.caption,
        uploaderId: viewer.id,
        kind: 'entity' as const,
      })),
    );
    return true;
  });

  if (!stored) {
    /* Сущности нет — файлы уже лежат в хранилище, убираем за собой. */
    await Promise.all(saved.map((item) => removeUpload(item.url)));
    return { ok: false, error: 'Сущность не найдена' };
  }

  revalidatePath('/entities/[slug]', 'page');
  return { ok: true };
}

/** Убрать кадр с карточки. Плитка общая: снять её может любой вошедший —
 *  права те же, что у достижений и у «Галереи». */
export async function deleteEntityImage(imageId: string): Promise<EntityImageResult> {
  await requireViewer();

  const outcome = await runDb(
    async (db): Promise<{ status: 'gone' } | { status: 'removed'; url: string | null }> => {
      const [row] = await db
        .select({ url: t.images.url })
        .from(t.images)
        /* Кадр «Галереи» снимает deleteImage, достижение — своё действие:
         * у каждого свой revalidate и своё подтверждение. */
        .where(and(eq(t.images.id, imageId), eq(t.images.kind, 'entity')))
        .limit(1);
      if (!row) return { status: 'gone' };

      await db.delete(t.images).where(eq(t.images.id, imageId));
      return { status: 'removed', url: row.url };
    },
  );

  if (outcome.status === 'gone') return { ok: false, error: 'Кадр уже убрали' };

  await removeUpload(outcome.url);

  revalidatePath('/entities/[slug]', 'page');
  return { ok: true };
}
