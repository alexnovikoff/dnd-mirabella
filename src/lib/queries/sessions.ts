/* Запросы экрана сессии: что произошло за игру и чем она обросла. */

import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { runDb, type Db } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import type { Viewer } from '@/lib/auth-shared';
import { visibleEntries } from '@/lib/visibility';
import { NO_SESSION } from '@/lib/sessions-shared';

/** Сессия в выпадающем списке шита быстрой записи. */
export type SessionOption = {
  id: string;
  number: number;
  title: string | null;
  date: string | null;
};

/** Сессии для выбора при записи: последняя сверху — она же подставляется
 *  по умолчанию. Их десятки, а не тысячи, поэтому список отдаётся целиком. */
export function getSessionOptions(): Promise<SessionOption[]> {
  return runDb((db) =>
    db
      .select({
        id: t.sessions.id,
        number: t.sessions.number,
        title: t.sessions.title,
        date: t.sessions.date,
      })
      .from(t.sessions)
      .where(eq(t.sessions.campaignId, CAMPAIGN_ID))
      .orderBy(desc(t.sessions.number)),
  );
}

/** id сессии, выбранной в шите, — если она вообще из этой кампании.
 *  Чужой или устаревший id из формы не должен уводить запись в другую
 *  кампанию, поэтому проверяем, а не доверяем. */
export async function findSessionId(db: Db, requested: string | null): Promise<string | null> {
  if (!requested) return null;

  const [chosen] = await db
    .select({ id: t.sessions.id })
    .from(t.sessions)
    .where(and(eq(t.sessions.id, requested), eq(t.sessions.campaignId, CAMPAIGN_ID)))
    .limit(1);
  return chosen?.id ?? null;
}

/** Активная сессия — последняя по номеру. */
export async function activeSessionId(db: Db): Promise<string | null> {
  const [active] = await db
    .select({ id: t.sessions.id })
    .from(t.sessions)
    .where(eq(t.sessions.campaignId, CAMPAIGN_ID))
    .orderBy(desc(t.sessions.number))
    .limit(1);
  return active?.id ?? null;
}

/** Сессия новой записи: выбранная в шите, иначе активная.
 *  NO_SESSION — осознанный выбор «вне сессий»: подставлять активную нельзя. */
export async function resolveSessionId(db: Db, requested?: string | null): Promise<string | null> {
  if (requested === NO_SESSION) return null;
  return (await findSessionId(db, requested ?? null)) ?? activeSessionId(db);
}

/** Куда переносит запись выбор в шите правки: null — выбора не делали,
 *  запись остаётся там, где была; { id: null } — выбрали «Без сессии». */
export async function findSessionMove(
  db: Db,
  requested: string | null | undefined,
): Promise<{ id: string | null } | null> {
  if (!requested) return null;
  if (requested === NO_SESSION) return { id: null };

  const id = await findSessionId(db, requested);
  return id ? { id } : null;
}

/** Полный список сессий: последняя сверху. Счётчик записей считается по тем,
 *  что зритель вправе увидеть, — иначе список выдавал бы чужие черновики. */
export function getSessions(viewer: Viewer | null = null) {
  return runDb(async (db) => {
    const rows = await db
      .select({
        id: t.sessions.id,
        number: t.sessions.number,
        title: t.sessions.title,
        date: t.sessions.date,
        location: t.sessions.location,
      })
      .from(t.sessions)
      .where(eq(t.sessions.campaignId, CAMPAIGN_ID))
      .orderBy(desc(t.sessions.number));

    const visible = visibleEntries(viewer);
    const counts = await db
      .select({ sessionId: t.entries.sessionId, n: sql<number>`count(*)::int` })
      .from(t.entries)
      .where(and(eq(t.entries.campaignId, CAMPAIGN_ID), ...(visible ? [visible] : [])))
      .groupBy(t.entries.sessionId);
    const byId = new Map(counts.map((row) => [row.sessionId, row.n]));

    return rows.map((row) => ({ ...row, entries: byId.get(row.id) ?? 0 }));
  });
}

export function getSession(number: number, viewer: Viewer | null) {
  return runDb(async (db) => {
    const [session] = await db
      .select()
      .from(t.sessions)
      .where(and(eq(t.sessions.campaignId, CAMPAIGN_ID), eq(t.sessions.number, number)))
      .limit(1);
    if (!session) return null;

    const visible = visibleEntries(viewer);
    const entries = await db
      .select({
        id: t.entries.id,
        kind: t.entries.kind,
        title: t.entries.title,
        body: t.entries.body,
        sessionId: t.entries.sessionId,
        roll: t.entries.roll,
        isCrit: t.entries.isCrit,
        isFail: t.entries.isFail,
        visibility: t.entries.visibility,
        authorId: t.entries.authorId,
        subjectId: t.entries.subjectId,
        authorName: t.users.name,
      })
      .from(t.entries)
      .leftJoin(t.users, eq(t.users.id, t.entries.authorId))
      .where(
        and(
          eq(t.entries.campaignId, CAMPAIGN_ID),
          eq(t.entries.sessionId, session.id),
          ...(visible ? [visible] : []),
        ),
      )
      .orderBy(asc(t.entries.createdAt), asc(t.entries.id));

    const images = await db
      .select({ id: t.images.id, caption: t.images.caption, url: t.images.url })
      .from(t.images)
      .where(eq(t.images.sessionId, session.id))
      .orderBy(desc(t.images.isKey), desc(t.images.createdAt));

    /* Соседние сессии — чтобы листать хронику по играм. */
    const neighbours = await db
      .select({ number: t.sessions.number })
      .from(t.sessions)
      .where(eq(t.sessions.campaignId, CAMPAIGN_ID))
      .orderBy(asc(t.sessions.number));
    const numbers = neighbours.map((row) => row.number);
    const index = numbers.indexOf(session.number);

    return {
      ...session,
      entries,
      images,
      previous: index > 0 ? numbers[index - 1] : null,
      next: index >= 0 && index < numbers.length - 1 ? numbers[index + 1] : null,
    };
  });
}
