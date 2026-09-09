/* Запросы экрана «Цитаты»: сетка, цитата недели, голоса, фильтр по автору. */

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import type { Visibility } from '@/lib/db/schema';
import type { Viewer } from '@/lib/auth-shared';

export type QuoteCard = {
  id: string;
  body: string | null;
  /** Кому цитата приписана: персонаж, а если его нет — тот, кто её записал. */
  authorName: string | null;
  authorSlug: string | null;
  /** Кто завёл запись. Нужен, чтобы решить, показывать ли правку с удалением. */
  authorId: string | null;
  /** Персонаж-говорящий: шит правки открывается с ним в селекте. */
  subjectId: string | null;
  visibility: Visibility;
  sessionNumber: number | null;
  votes: number;
  myVote: boolean;
};

/** Кто может быть автором цитаты: партия плюс мастер. */
export function getQuoteAuthors() {
  return runDb(async (db) => {
    const characters = await db
      .select({ id: t.nodes.id, name: t.nodes.name, slug: t.nodes.slug })
      .from(t.characters)
      .innerJoin(t.nodes, eq(t.nodes.id, t.characters.nodeId))
      .where(eq(t.nodes.campaignId, CAMPAIGN_ID))
      .orderBy(t.nodes.name);

    return characters;
  });
}

export function getQuotes(authorSlug: string | null, viewer: Viewer | null) {
  return runDb(async (db) => {
    const conditions = [
      eq(t.entries.campaignId, CAMPAIGN_ID),
      eq(t.entries.kind, 'quote'),
      eq(t.entries.visibility, 'public'),
    ];

    const rows = await db
      .select({
        id: t.entries.id,
        body: t.entries.body,
        sessionNumber: t.sessions.number,
        authorId: t.entries.authorId,
        subjectId: t.entries.subjectId,
        visibility: t.entries.visibility,
        authorName: t.nodes.name,
        authorSlug: t.nodes.slug,
        fallbackAuthor: t.users.name,
      })
      .from(t.entries)
      .leftJoin(t.sessions, eq(t.sessions.id, t.entries.sessionId))
      .leftJoin(t.nodes, eq(t.nodes.id, t.entries.subjectId))
      .leftJoin(t.users, eq(t.users.id, t.entries.authorId))
      .where(and(...conditions))
      .orderBy(desc(t.entries.createdAt), desc(t.entries.id));

    const ids = rows.map((row) => row.id);
    const voteRows =
      ids.length === 0
        ? []
        : await db
            .select({ entryId: t.votes.entryId, userId: t.votes.userId })
            .from(t.votes)
            .where(inArray(t.votes.entryId, ids));

    const counts = new Map<string, number>();
    const mine = new Set<string>();
    for (const vote of voteRows) {
      counts.set(vote.entryId, (counts.get(vote.entryId) ?? 0) + 1);
      if (viewer && vote.userId === viewer.id) mine.add(vote.entryId);
    }

    const all: QuoteCard[] = rows.map((row) => ({
      id: row.id,
      body: row.body,
      authorName: row.authorName ?? row.fallbackAuthor,
      authorSlug: row.authorSlug,
      authorId: row.authorId,
      subjectId: row.subjectId,
      visibility: row.visibility,
      sessionNumber: row.sessionNumber,
      votes: counts.get(row.id) ?? 0,
      myVote: mine.has(row.id),
    }));

    const filtered = authorSlug ? all.filter((quote) => quote.authorSlug === authorSlug) : all;

    const [{ sessions }] = await db
      .select({ sessions: sql<number>`count(*)::int` })
      .from(t.sessions)
      .where(eq(t.sessions.campaignId, CAMPAIGN_ID));

    /* В цитатнике все цитаты равноценны: ни одну наверх не выносим. */
    return { total: all.length, sessions, quotes: filtered };
  });
}

/** Случайная цитата для «Хроники». Выбор делается на сервере при каждом
 *  запросе, поэтому обновление страницы показывает другую. */
export function getRandomQuote(viewer: Viewer | null): Promise<QuoteCard | null> {
  return runDb(async (db) => {
    const rows = await db
      .select({
        id: t.entries.id,
        body: t.entries.body,
        sessionNumber: t.sessions.number,
        authorId: t.entries.authorId,
        subjectId: t.entries.subjectId,
        visibility: t.entries.visibility,
        authorName: t.nodes.name,
        authorSlug: t.nodes.slug,
        fallbackAuthor: t.users.name,
      })
      .from(t.entries)
      .leftJoin(t.sessions, eq(t.sessions.id, t.entries.sessionId))
      .leftJoin(t.nodes, eq(t.nodes.id, t.entries.subjectId))
      .leftJoin(t.users, eq(t.users.id, t.entries.authorId))
      .where(
        and(
          eq(t.entries.campaignId, CAMPAIGN_ID),
          eq(t.entries.kind, 'quote'),
          eq(t.entries.visibility, 'public'),
        ),
      );

    if (rows.length === 0) return null;
    const row = rows[Math.floor(Math.random() * rows.length)];

    const votes = await db
      .select({ userId: t.votes.userId })
      .from(t.votes)
      .where(eq(t.votes.entryId, row.id));

    return {
      id: row.id,
      body: row.body,
      authorName: row.authorName ?? row.fallbackAuthor,
      authorSlug: row.authorSlug,
      authorId: row.authorId,
      subjectId: row.subjectId,
      visibility: row.visibility,
      sessionNumber: row.sessionNumber,
      votes: votes.length,
      myVote: viewer ? votes.some((vote) => vote.userId === viewer.id) : false,
    };
  });
}
