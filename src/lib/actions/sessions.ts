'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, desc, eq } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import { requireViewer } from './guard';

export type SessionResult = { ok: true; number: number } | { ok: false; error: string };

/** Новая сессия становится активной: к ней начинают цепляться записи. */
export async function createSession(): Promise<SessionResult> {
  await requireViewer();

  const number = await runDb(async (db) => {
    const [last] = await db
      .select({ number: t.sessions.number })
      .from(t.sessions)
      .where(eq(t.sessions.campaignId, CAMPAIGN_ID))
      .orderBy(desc(t.sessions.number))
      .limit(1);

    const next = (last?.number ?? 0) + 1;
    await db.insert(t.sessions).values({
      id: randomUUID(),
      campaignId: CAMPAIGN_ID,
      number: next,
      date: new Date().toISOString().slice(0, 10),
      title: null,
      location: null,
    });
    return next;
  });

  revalidatePath('/');
  revalidatePath('/sessions');
  revalidatePath('/gallery');
  revalidatePath(`/sessions/${number}`);
  return { ok: true, number };
}

export async function updateSession(
  number: number,
  patch: { title: string; date: string; location: string },
): Promise<SessionResult> {
  await requireViewer();

  const ok = await runDb(async (db) => {
    const result = await db
      .update(t.sessions)
      .set({
        title: patch.title.trim() || null,
        date: patch.date || null,
        location: patch.location.trim() || null,
      })
      .where(and(eq(t.sessions.campaignId, CAMPAIGN_ID), eq(t.sessions.number, number)))
      .returning({ number: t.sessions.number });
    return result.length > 0;
  });

  if (!ok) return { ok: false, error: 'Сессия не найдена' };

  revalidatePath('/');
  revalidatePath('/sessions');
  revalidatePath('/gallery');
  revalidatePath(`/sessions/${number}`);
  return { ok: true, number };
}

/**
 * Описание сессии — пересказ игры своими словами.
 *
 * Правит его любой вошедший: и игрок, и мастер. Сессия за столом общая, и
 * помнит её каждый по-своему — запирать пересказ за ролью не за что.
 *
 * Пустой текст стирает описание, поэтому «удалить» — тот же запрос, а не
 * отдельная ветка в базе.
 */
export async function saveSessionDescription(
  number: number,
  description: string,
): Promise<SessionResult> {
  await requireViewer();

  const ok = await runDb(async (db) => {
    const result = await db
      .update(t.sessions)
      .set({ description: description.trim() || null })
      .where(and(eq(t.sessions.campaignId, CAMPAIGN_ID), eq(t.sessions.number, number)))
      .returning({ number: t.sessions.number });
    return result.length > 0;
  });

  if (!ok) return { ok: false, error: 'Сессия не найдена' };

  revalidatePath('/sessions');
  revalidatePath(`/sessions/${number}`);
  return { ok: true, number };
}

export async function deleteSessionDescription(number: number): Promise<SessionResult> {
  return saveSessionDescription(number, '');
}
