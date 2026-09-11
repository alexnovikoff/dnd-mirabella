/* Запросы экрана «База знаний»: наводки со статусами, свободные заметки,
 * а также подтабы «Всё», NPC и Локации. */

import { and, desc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import type { Viewer } from '@/lib/auth-shared';
import { visibleEntries } from '@/lib/visibility';

export type KbTab = 'all' | 'notes' | 'npc' | 'locations';

/** Первый таб — тот, что открывается без query-параметра. */
export const KB_TABS: { id: KbTab; label: string }[] = [
  { id: 'all', label: 'ВСЁ' },
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
  /** Тип узла — мета под названием карточки: NPC, ЛОКАЦИЯ и так далее. */
  kind: t.NodeKind;
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
        kind: t.nodes.kind,
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

/** Свободные заметки. Личные видит автор, мастер — все. */
export function getFreeNotes(viewer: Viewer | null): Promise<FreeNote[]> {
  return runDb(async (db) => {
    const visible = visibleEntries(viewer);

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
      .where(and(eq(t.entries.campaignId, CAMPAIGN_ID), eq(t.entries.kind, 'note'), visible))
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
        kind: t.nodes.kind,
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

/** Таб «Всё»: наводки, NPC и локации одним списком. Узел со статусом попадает
 *  и в наводки, и в свой тип — в объединении он остаётся один раз, в порядке
 *  первой группы (наводки идут по статусу, остальные по имени). */
export function mergeKbCards(...groups: RumorCard[][]): RumorCard[] {
  const byId = new Map<string, RumorCard>();
  for (const group of groups) {
    for (const card of group) {
      if (!byId.has(card.id)) byId.set(card.id, card);
    }
  }
  return [...byId.values()];
}
