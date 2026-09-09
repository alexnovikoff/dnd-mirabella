/* Запросы экрана сессии: что произошло за игру и чем она обросла. */

import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import type { Viewer } from '@/lib/auth-shared';
import { visibleEntries } from '@/lib/visibility';

export function getSessions() {
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

    const counts = await db
      .select({ sessionId: t.entries.sessionId, n: sql<number>`count(*)::int` })
      .from(t.entries)
      .where(eq(t.entries.campaignId, CAMPAIGN_ID))
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
