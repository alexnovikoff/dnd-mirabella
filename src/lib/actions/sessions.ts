'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, desc, eq } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import { syncSessionLinks } from '@/lib/wiki/sync-links';
import { requireViewer } from './guard';
import { createDraftNode } from './entries';

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

export type DescriptionResult =
  { ok: true; number: number; unresolved: string[] } | { ok: false; error: string };

/**
 * Описание сессии — пересказ игры своими словами.
 *
 * Правит его любой вошедший: и игрок, и мастер. Сессия за столом общая, и
 * помнит её каждый по-своему — запирать пересказ за ролью не за что.
 *
 * Пустой текст стирает описание, поэтому «удалить» — тот же запрос, а не
 * отдельная ветка в базе.
 *
 * Вместе с текстом пересчитываются рёбра-упоминания: [[ссылка]] в пересказе
 * — такая же ссылка, как в моменте, и узел должен узнать о ней в базе знаний
 * и на доске связей. Убранная из текста — ребро уносит.
 */
export async function saveSessionDescription(
  number: number,
  description: string,
): Promise<DescriptionResult> {
  await requireViewer();

  const saved = await runDb(async (db) => {
    const body = description.trim() || null;

    const [session] = await db
      .update(t.sessions)
      .set({ description: body })
      .where(and(eq(t.sessions.campaignId, CAMPAIGN_ID), eq(t.sessions.number, number)))
      .returning({ id: t.sessions.id });
    if (!session) return null;

    const sync = await syncSessionLinks(db, CAMPAIGN_ID, session.id, body);
    return sync.unresolved;
  });

  if (saved === null) return { ok: false, error: 'Сессия не найдена' };

  revalidatePath('/sessions');
  revalidatePath(`/sessions/${number}`);
  /* Ссылки из пересказа — те же рёбра графа: панель узла, доска и счётчики
   * связей в базе знаний меняются вместе с текстом. */
  revalidatePath('/board');
  revalidatePath('/kb');
  revalidatePath('/entities/[slug]', 'page');
  return { ok: true, number, unresolved: saved };
}

export async function deleteSessionDescription(number: number): Promise<DescriptionResult> {
  return saveSessionDescription(number, '');
}

/** Завести сущность по имени, оставшемуся неразрешённым в уже сохранённом
 *  пересказе, и сразу пересчитать рёбра сессии — пересчёт бывает только при
 *  сохранении, иначе ребро не появится никогда. Близнец resolveMention для
 *  записей. */
export async function resolveSessionMention(
  number: number,
  name: string,
): Promise<DescriptionResult> {
  await requireViewer();
  if (!name.trim()) return { ok: false, error: 'Пустое имя сущности' };

  await createDraftNode(name);

  const unresolved = await runDb(async (db) => {
    const [session] = await db
      .select({ id: t.sessions.id, description: t.sessions.description })
      .from(t.sessions)
      .where(and(eq(t.sessions.campaignId, CAMPAIGN_ID), eq(t.sessions.number, number)))
      .limit(1);
    if (!session) return null;

    const sync = await syncSessionLinks(db, CAMPAIGN_ID, session.id, session.description);
    return sync.unresolved;
  });

  if (unresolved === null) return { ok: false, error: 'Сессия не найдена' };

  revalidatePath(`/sessions/${number}`);
  revalidatePath('/board');
  revalidatePath('/kb');
  revalidatePath('/entities/[slug]', 'page');
  return { ok: true, number, unresolved };
}

/**
 * Удаление сессии — обычно только что заведённой по ошибке.
 *
 * Содержимое игры не пропадает: `entries.session_id`, `images.session_id` и
 * `nodes.first_session_id` объявлены `on delete set null`, поэтому записи,
 * цитаты и кадры остаются в хронике и галерее — просто вне сессий. Стирать
 * чужие моменты заодно с шапкой игры было бы слишком.
 *
 * Номера соседей не пересчитываются: на них ссылаются адреса `/sessions/12`
 * и «играет с сессии» у персонажей. Дыра в нумерации честнее сдвига.
 */
export async function deleteSession(number: number): Promise<SessionResult> {
  await requireViewer();

  const ok = await runDb(async (db) => {
    const result = await db
      .delete(t.sessions)
      .where(and(eq(t.sessions.campaignId, CAMPAIGN_ID), eq(t.sessions.number, number)))
      .returning({ number: t.sessions.number });
    return result.length > 0;
  });

  if (!ok) return { ok: false, error: 'Сессия не найдена' };

  revalidatePath('/');
  revalidatePath('/sessions');
  revalidatePath('/gallery');
  revalidatePath('/quotes');
  revalidatePath('/board');
  revalidatePath('/kb');
  revalidatePath('/characters/[slug]', 'page');
  revalidatePath(`/sessions/${number}`);
  return { ok: true, number };
}
