/* Запросы экрана «Доска связей»: узлы с координатами, ручные рёбра
 * и панель выбранного узла. */

import { and, eq, or } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';

export type BoardNode = {
  id: string;
  name: string;
  slug: string;
  kind: t.NodeKind;
  status: t.NodeStatus | null;
  x: number;
  y: number;
};

export type BoardEdge = { id: string; from: string; to: string; label: string | null };

export function getBoard() {
  return runDb(async (db) => {
    const nodes = await db
      .select({
        id: t.nodes.id,
        name: t.nodes.name,
        slug: t.nodes.slug,
        kind: t.nodes.kind,
        status: t.nodes.status,
        x: t.boardPositions.x,
        y: t.boardPositions.y,
      })
      .from(t.boardPositions)
      .innerJoin(t.nodes, eq(t.nodes.id, t.boardPositions.nodeId))
      .where(eq(t.nodes.campaignId, CAMPAIGN_ID))
      .orderBy(t.nodes.name);

    const positioned = new Set(nodes.map((node) => node.id));

    const rows = await db
      .select({
        id: t.links.id,
        from: t.links.fromNodeId,
        to: t.links.toNodeId,
        label: t.links.label,
      })
      .from(t.links)
      .where(and(eq(t.links.campaignId, CAMPAIGN_ID), eq(t.links.kind, 'manual')));

    const edges: BoardEdge[] = rows
      .filter((row) => row.from !== null && positioned.has(row.from) && positioned.has(row.to))
      .map((row) => ({ id: row.id, from: row.from as string, to: row.to, label: row.label }));

    return { nodes, edges };
  });
}

export type NodeDetail = {
  id: string;
  name: string;
  slug: string;
  kind: t.NodeKind;
  status: t.NodeStatus | null;
  description: string | null;
  relations: { id: string; name: string; slug: string; label: string | null }[];
  mentions: {
    moments: { id: string; title: string | null; sessionNumber: number | null }[];
    notes: number;
    images: number;
  };
};

/** Панель узла: описание, ручные связи и где узел упоминается. */
export function getNodeDetail(slug: string): Promise<NodeDetail | null> {
  return runDb(async (db) => {
    const [node] = await db
      .select()
      .from(t.nodes)
      .where(and(eq(t.nodes.campaignId, CAMPAIGN_ID), eq(t.nodes.slug, slug)))
      .limit(1);
    if (!node) return null;

    const manual = await db
      .select({ from: t.links.fromNodeId, to: t.links.toNodeId, label: t.links.label })
      .from(t.links)
      .where(
        and(
          eq(t.links.kind, 'manual'),
          or(eq(t.links.fromNodeId, node.id), eq(t.links.toNodeId, node.id)),
        ),
      );

    const others = await db
      .select({ id: t.nodes.id, name: t.nodes.name, slug: t.nodes.slug })
      .from(t.nodes)
      .where(eq(t.nodes.campaignId, CAMPAIGN_ID));
    const byId = new Map(others.map((row) => [row.id, row]));

    const relations = manual
      .map((link) => {
        const otherId = link.from === node.id ? link.to : link.from;
        const other = otherId ? byId.get(otherId) : undefined;
        return other ? { ...other, label: link.label } : null;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const mentionRows = await db
      .select({
        entryId: t.links.fromEntryId,
        kind: t.entries.kind,
        title: t.entries.title,
        sessionNumber: t.sessions.number,
      })
      .from(t.links)
      .innerJoin(t.entries, eq(t.entries.id, t.links.fromEntryId))
      .leftJoin(t.sessions, eq(t.sessions.id, t.entries.sessionId))
      .where(and(eq(t.links.kind, 'mention'), eq(t.links.toNodeId, node.id)));

    const moments = mentionRows
      .filter((row) => row.kind === 'moment' && row.entryId)
      .map((row) => ({
        id: row.entryId as string,
        title: row.title,
        sessionNumber: row.sessionNumber,
      }));

    return {
      id: node.id,
      name: node.name,
      slug: node.slug,
      kind: node.kind,
      status: node.status,
      description: node.description,
      relations,
      mentions: {
        moments,
        notes: mentionRows.filter((row) => row.kind === 'note').length,
        images: mentionRows.filter((row) => row.kind === 'image').length,
      },
    };
  });
}
