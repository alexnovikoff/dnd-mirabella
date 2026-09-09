/* Запросы экрана «База знаний»: наводки со статусами, свободные заметки,
 * а также подтабы NPC и Локации. */

import { and, desc, eq, inArray, isNotNull, ne, or, sql } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';

export type KbTab = 'notes' | 'npc' | 'locations';

export const KB_TABS: { id: KbTab; label: string }[] = [
  { id: 'notes', label: 'ЗАМЕТКИ' },
  { id: 'npc', label: 'NPC' },
  { id: 'locations', label: 'ЛОКАЦИИ' },
];

export function isKbTab(value: string | undefined): value is KbTab {
  return KB_TABS.some((tab) => tab.id === value);
}

export type RumorCard = {
  id: string;
  name: string;
  slug: string;
  status: t.NodeStatus | null;
  links: number;
  /** Чипы связанных сущностей под карточкой. */
  related: { id: string; name: string; slug: string }[];
};

export type FreeNote = {
  id: string;
  body: string | null;
  authorName: string | null;
  sessionNumber: number | null;
  isPrivate: boolean;
};

/** Наводки: узлы со статусом, счётчик связей и соседи по ручным рёбрам. */
export function getRumors(): Promise<RumorCard[]> {
  return runDb(async (db) => {
    const rows = await db
      .select({
        id: t.nodes.id,
        name: t.nodes.name,
        slug: t.nodes.slug,
        status: t.nodes.status,
        links: sql<number>`count(${t.links.id})::int`,
      })
      .from(t.nodes)
      .leftJoin(t.links, eq(t.links.toNodeId, t.nodes.id))
      .where(and(eq(t.nodes.campaignId, CAMPAIGN_ID), isNotNull(t.nodes.status)))
      .groupBy(t.nodes.id)
      .orderBy(t.nodes.status, t.nodes.name);

    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    const manual = await db
      .select({
        from: t.links.fromNodeId,
        to: t.links.toNodeId,
        label: t.links.label,
      })
      .from(t.links)
      .where(
        and(
          eq(t.links.campaignId, CAMPAIGN_ID),
          eq(t.links.kind, 'manual'),
          or(inArray(t.links.toNodeId, ids), inArray(t.links.fromNodeId, ids)),
        ),
      );

    const names = await db
      .select({ id: t.nodes.id, name: t.nodes.name, slug: t.nodes.slug })
      .from(t.nodes)
      .where(eq(t.nodes.campaignId, CAMPAIGN_ID));
    const byId = new Map(names.map((n) => [n.id, n]));

    return rows.map((row) => {
      const related = new Map<string, { id: string; name: string; slug: string }>();
      for (const link of manual) {
        const other = link.from === row.id ? link.to : link.to === row.id ? link.from : null;
        if (!other) continue;
        const node = byId.get(other);
        if (node) related.set(node.id, node);
      }
      return { ...row, related: [...related.values()] };
    });
  });
}

/** Свободные заметки. Личные видит только автор — до этапа 9 автор один. */
export function getFreeNotes(viewerId: string | null): Promise<FreeNote[]> {
  return runDb(async (db) => {
    const visible = viewerId
      ? or(eq(t.entries.visibility, 'public'), eq(t.entries.authorId, viewerId))
      : eq(t.entries.visibility, 'public');

    const rows = await db
      .select({
        id: t.entries.id,
        body: t.entries.body,
        visibility: t.entries.visibility,
        authorName: t.users.name,
        sessionNumber: t.sessions.number,
      })
      .from(t.entries)
      .leftJoin(t.users, eq(t.users.id, t.entries.authorId))
      .leftJoin(t.sessions, eq(t.sessions.id, t.entries.sessionId))
      .where(
        and(
          eq(t.entries.campaignId, CAMPAIGN_ID),
          eq(t.entries.kind, 'note'),
          ne(t.entries.visibility, 'draft'),
          visible,
        ),
      )
      .orderBy(desc(t.entries.createdAt), desc(t.entries.id));

    return rows.map((row) => ({
      id: row.id,
      body: row.body,
      authorName: row.authorName,
      sessionNumber: row.sessionNumber,
      isPrivate: row.visibility === 'private',
    }));
  });
}

/** Подтабы NPC и Локации: узлы соответствующего типа со счётчиком связей. */
export function getNodesByKind(kind: t.NodeKind): Promise<RumorCard[]> {
  return runDb(async (db) => {
    const rows = await db
      .select({
        id: t.nodes.id,
        name: t.nodes.name,
        slug: t.nodes.slug,
        status: t.nodes.status,
        links: sql<number>`count(${t.links.id})::int`,
      })
      .from(t.nodes)
      .leftJoin(t.links, eq(t.links.toNodeId, t.nodes.id))
      .where(and(eq(t.nodes.campaignId, CAMPAIGN_ID), eq(t.nodes.kind, kind)))
      .groupBy(t.nodes.id)
      .orderBy(t.nodes.name);

    return rows.map((row) => ({ ...row, related: [] }));
  });
}
