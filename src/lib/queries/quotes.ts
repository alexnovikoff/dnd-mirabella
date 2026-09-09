/* Запросы экрана «Цитаты»: сетка, цитата недели, голоса, фильтр по автору. */

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';

export type QuoteCard = {
  id: string;
  body: string | null;
  authorName: string | null;
  authorSlug: string | null;
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

export function getQuotes(authorSlug: string | null, viewerId: string | null) {
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
        createdAt: t.entries.createdAt,
        sessionNumber: t.sessions.number,
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
      if (viewerId && vote.userId === viewerId) mine.add(vote.entryId);
    }

    const all: QuoteCard[] = rows.map((row) => ({
      id: row.id,
      body: row.body,
      authorName: row.authorName ?? row.fallbackAuthor,
      authorSlug: row.authorSlug,
      sessionNumber: row.sessionNumber,
      votes: counts.get(row.id) ?? 0,
      myVote: mine.has(row.id),
    }));

    /* Цитата недели — максимум голосов среди цитат за последние 7 дней
     * (README «Голосование за цитату»). */
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const recent = rows.filter((row) => row.createdAt.getTime() >= weekAgo).map((row) => row.id);
    const ofWeek =
      all
        .filter((quote) => recent.includes(quote.id) && quote.votes > 0)
        .sort((a, b) => b.votes - a.votes)[0] ?? null;

    const filtered = authorSlug ? all.filter((quote) => quote.authorSlug === authorSlug) : all;

    const [{ sessions }] = await db
      .select({ sessions: sql<number>`count(*)::int` })
      .from(t.sessions)
      .where(eq(t.sessions.campaignId, CAMPAIGN_ID));

    return {
      total: all.length,
      sessions,
      ofWeek,
      quotes: filtered.filter((quote) => quote.id !== ofWeek?.id),
    };
  });
}

/** Сколько голосов у цитаты сейчас — после переключения голоса. */
export function countVotes(entryId: string) {
  return runDb(async (db) => {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(t.votes)
      .where(eq(t.votes.entryId, entryId));
    return row?.n ?? 0;
  });
}
