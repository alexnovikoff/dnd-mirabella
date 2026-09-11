'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import { requireViewer } from './guard';

export type CampaignResult = { ok: true } | { ok: false; error: string };

/**
 * Анонс следующей игры — строка над лентой «Хроники».
 *
 * Правит его любой вошедший, как и пересказ сессии: дату игры за столом
 * назначают вместе, и запирать её за ролью мастера не за что.
 *
 * Пустой текст стирает анонс, поэтому «удалить» — тот же запрос, а не
 * отдельная ветка в базе.
 */
export async function saveNextGame(text: string): Promise<CampaignResult> {
  await requireViewer();

  const ok = await runDb(async (db) => {
    const result = await db
      .update(t.campaigns)
      .set({ nextGame: text.trim() || null })
      .where(eq(t.campaigns.id, CAMPAIGN_ID))
      .returning({ id: t.campaigns.id });
    return result.length > 0;
  });

  if (!ok) return { ok: false, error: 'Кампания не найдена' };

  revalidatePath('/');
  return { ok: true };
}

export async function deleteNextGame(): Promise<CampaignResult> {
  return saveNextGame('');
}
