/* Запросы экрана «Цитаты»: сетка, цитата недели, голоса, фильтр по автору. */

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import type { Viewer } from '@/lib/auth-shared';

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
      sessionNumber: row.sessionNumber,
      votes: counts.get(row.id) ?? 0,
      myVote: mine.has(row.id),
    }));

    const filtered = authorSlug ? all.filter((quote) => quote.authorSlug === authorSlug) : all;

    /* Наверху страницы — случайная цитата из тех, что видны при текущем
     * фильтре. Выбор делается на сервере при каждом запросе, поэтому
     * обновление страницы её меняет. */
    const featured =
      filtered.length > 0 ? filtered[Math.floor(Math.random() * filtered.length)] : null;

    const [{ sessions }] = await db
      .select({ sessions: sql<number>`count(*)::int` })
      .from(t.sessions)
      .where(eq(t.sessions.campaignId, CAMPAIGN_ID));

    return {
      total: all.length,
      sessions,
      featured,
      quotes: filtered.filter((quote) => quote.id !== featured?.id),
    };
  });
}
