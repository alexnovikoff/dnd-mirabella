/* Запросы страницы персонажа: метрики, его записи, связи, личная заметка. */

import { and, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import type { Viewer } from '@/lib/auth-shared';

export type CharacterEntry = {
  id: string;
  kind: t.EntryKind;
  title: string | null;
  body: string | null;
  roll: number | null;
  isCrit: boolean;
  isFail: boolean;
  sessionNumber: number | null;
  votes: number;
  visibility: t.Visibility;
  authorId: string | null;
  subjectId: string | null;
};

export function getCharacter(slug: string, viewer: Viewer | null) {
  return runDb(async (db) => {
    const [row] = await db
      .select({
        id: t.nodes.id,
        name: t.nodes.name,
        slug: t.nodes.slug,
        description: t.nodes.description,
        race: t.characters.race,
        classes: t.characters.classes,
        level: t.characters.level,
        portrait: t.characters.portrait,
        bio: t.characters.bio,
        sinceSession: t.characters.sinceSession,
        playerId: t.characters.playerId,
      })
      .from(t.characters)
      .innerJoin(t.nodes, eq(t.nodes.id, t.characters.nodeId))
      .where(and(eq(t.nodes.campaignId, CAMPAIGN_ID), eq(t.nodes.slug, slug)))
      .limit(1);

    if (!row) return null;

    const entryRows = await db
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
        sessionNumber: t.sessions.number,
      })
      .from(t.entries)
      .leftJoin(t.sessions, eq(t.sessions.id, t.entries.sessionId))
      .where(and(eq(t.entries.campaignId, CAMPAIGN_ID), eq(t.entries.subjectId, row.id)))
      .orderBy(desc(t.entries.createdAt), desc(t.entries.id));

    const ids = entryRows.map((entry) => entry.id);
    const voteRows =
      ids.length === 0
        ? []
        : await db
            .select({ entryId: t.votes.entryId, n: sql<number>`count(*)::int` })
            .from(t.votes)
            .where(inArray(t.votes.entryId, ids))
            .groupBy(t.votes.entryId);
    const votes = new Map(voteRows.map((v) => [v.entryId, v.n]));

    const withVotes = (entry: (typeof entryRows)[number]): CharacterEntry => ({
      id: entry.id,
      kind: entry.kind,
      title: entry.title,
      body: entry.body,
      roll: entry.roll,
      isCrit: entry.isCrit,
      isFail: entry.isFail,
      sessionNumber: entry.sessionNumber,
      votes: votes.get(entry.id) ?? 0,
      visibility: entry.visibility,
      authorId: entry.authorId,
      subjectId: row.id,
    });

    const publicEntries = entryRows.filter(
      (entry) =>
        entry.visibility === 'public' || (viewer?.role === 'dm' && entry.visibility === 'dm_only'),
    );

    /* README: личная заметка видна только владельцу и мастеру. */
    const privateNotes = entryRows
      .filter((entry) => entry.visibility === 'private' && entry.kind === 'note')
      .filter((entry) => viewer !== null && (viewer.role === 'dm' || entry.authorId === viewer.id))
      .map(withVotes);

    const manual = await db
      .select({
        linkId: t.links.id,
        from: t.links.fromNodeId,
        to: t.links.toNodeId,
        label: t.links.label,
      })
      .from(t.links)
      .where(
        and(
          eq(t.links.kind, 'manual'),
          or(eq(t.links.fromNodeId, row.id), eq(t.links.toNodeId, row.id)),
        ),
      );

    const others = await db
      .select({ id: t.nodes.id, name: t.nodes.name, slug: t.nodes.slug })
      .from(t.nodes)
      .where(eq(t.nodes.campaignId, CAMPAIGN_ID));
    const byId = new Map(others.map((node) => [node.id, node]));

    const relations = manual
      .map((link) => {
        const otherId = link.from === row.id ? link.to : link.from;
        const other = otherId ? byId.get(otherId) : undefined;
        return other ? { linkId: link.linkId, ...other, label: link.label } : null;
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    /* Достижения из блока внизу страницы в эту сетку не идут: у них своя
     * галерея, и считать их дважды не за что. */
    const images = row.playerId
      ? await db
          .select({ id: t.images.id, caption: t.images.caption, url: t.images.url })
          .from(t.images)
          .where(
            and(
              eq(t.images.campaignId, CAMPAIGN_ID),
              eq(t.images.uploaderId, row.playerId),
              ne(t.images.kind, 'achievement'),
            ),
          )
          .orderBy(desc(t.images.createdAt))
      : [];

    const achievements = await db
      .select({
        id: t.images.id,
        url: t.images.url,
        caption: t.images.caption,
        uploaderId: t.images.uploaderId,
        uploaderName: t.users.name,
      })
      .from(t.images)
      .leftJoin(t.users, eq(t.users.id, t.images.uploaderId))
      .where(
        and(
          eq(t.images.campaignId, CAMPAIGN_ID),
          eq(t.images.nodeId, row.id),
          eq(t.images.kind, 'achievement'),
        ),
      )
      .orderBy(desc(t.images.createdAt), desc(t.images.id));

    return {
      ...row,
      moments: publicEntries.filter((entry) => entry.kind === 'moment').map(withVotes),
      quotes: publicEntries.filter((entry) => entry.kind === 'quote').map(withVotes),
      privateNotes,
      relations,
      images,
      achievements,
      metrics: {
        moments: publicEntries.filter((entry) => entry.kind === 'moment').length,
        quotes: publicEntries.filter((entry) => entry.kind === 'quote').length,
        links: relations.length,
        crits: publicEntries.filter((entry) => entry.isCrit).length,
      },
    };
  });
}

/** Все персонажи — для маршрута /party и подсказок. */
export function getCharacters() {
  return runDb((db) =>
    db
      .select({
        id: t.nodes.id,
        name: t.nodes.name,
        slug: t.nodes.slug,
        race: t.characters.race,
        classes: t.characters.classes,
        bio: t.characters.bio,
        portrait: t.characters.portrait,
      })
      .from(t.characters)
      .innerJoin(t.nodes, eq(t.nodes.id, t.characters.nodeId))
      .where(eq(t.nodes.campaignId, CAMPAIGN_ID))
      .orderBy(t.nodes.name),
  );
}
