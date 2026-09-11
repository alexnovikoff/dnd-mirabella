/* Запросы экрана «Доска связей»: узлы с координатами, ручные рёбра
 * и панель выбранного узла. */

import { and, desc, eq, or } from 'drizzle-orm';
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

export type BoardEdge = {
  id: string;
  from: string;
  to: string;
  label: string | null;
  /** 'manual' — связь поставлена руками; 'mention' — узлы названы в одной
   *  записи, ребро выведено из текста и рисуется тоньше. */
  kind: 'manual' | 'mention';
};

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

    const manual: BoardEdge[] = rows
      .filter((row) => row.from !== null && positioned.has(row.from) && positioned.has(row.to))
      .map((row) => ({
        id: row.id,
        from: row.from as string,
        to: row.to,
        label: row.label,
        kind: 'manual' as const,
      }));

    /* Ребро-упоминание: два узла, названные в одной записи. README —
     * «ссылки ставятся из текста и одновременно образуют граф»; без этого
     * половина связей кампании на доску не попадала. */
    const mentionRows = await db
      .select({ entryId: t.links.fromEntryId, nodeId: t.links.toNodeId })
      .from(t.links)
      .where(and(eq(t.links.campaignId, CAMPAIGN_ID), eq(t.links.kind, 'mention')));

    const byEntry = new Map<string, string[]>();
    for (const row of mentionRows) {
      if (!row.entryId || !positioned.has(row.nodeId)) continue;
      const list = byEntry.get(row.entryId) ?? [];
      list.push(row.nodeId);
      byEntry.set(row.entryId, list);
    }

    /* Ключ пары не зависит от направления: ручная связь A→B гасит
     * выведенную B→A, иначе линии лягут друг на друга. */
    const pairKey = (a: string, b: string) => [a, b].sort().join('::');
    const drawn = new Set(manual.map((edge) => pairKey(edge.from, edge.to)));

    const mention: BoardEdge[] = [];
    for (const nodeIds of byEntry.values()) {
      const unique = [...new Set(nodeIds)];
      for (let i = 0; i < unique.length; i += 1) {
        for (let j = i + 1; j < unique.length; j += 1) {
          const key = pairKey(unique[i], unique[j]);
          if (drawn.has(key)) continue;
          drawn.add(key);
          mention.push({
            id: `mention:${key}`,
            from: unique[i],
            to: unique[j],
            label: null,
            kind: 'mention',
          });
        }
      }
    }

    return { nodes, edges: [...manual, ...mention] };
  });
}

export type NodeDetail = {
  id: string;
  name: string;
  slug: string;
  kind: t.NodeKind;
  status: t.NodeStatus | null;
  description: string | null;
  /** Прежние имена: по ним резолвятся [[ссылки]] в старых записях. */
  aliases: string[];
  /** Персонаж партии: тип не меняется, удалить нельзя. */
  isCharacter: boolean;
  /** Кадры, приложенные к самой карточке: их грузят и снимают прямо здесь.
   *  Не путать с mentions.images — там счётчик записей-фото, где узел назван
   *  в тексте. */
  images: { id: string; url: string | null; caption: string | null; uploaderName: string | null }[];
  relations: {
    /** id ребра — по нему связь правят и удаляют. */
    linkId: string;
    id: string;
    name: string;
    slug: string;
    label: string | null;
  }[];
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
        return other ? { linkId: link.linkId, ...other, label: link.label } : null;
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

    /* Кадры карточки: у достижений персонажа та же привязка к узлу,
     * поэтому вид проверяем явно. */
    const images = await db
      .select({
        id: t.images.id,
        url: t.images.url,
        caption: t.images.caption,
        uploaderName: t.users.name,
      })
      .from(t.images)
      .leftJoin(t.users, eq(t.users.id, t.images.uploaderId))
      .where(and(eq(t.images.nodeId, node.id), eq(t.images.kind, 'entity')))
      .orderBy(desc(t.images.createdAt), desc(t.images.id));

    const [character] = await db
      .select({ nodeId: t.characters.nodeId })
      .from(t.characters)
      .where(eq(t.characters.nodeId, node.id))
      .limit(1);

    return {
      id: node.id,
      name: node.name,
      slug: node.slug,
      kind: node.kind,
      status: node.status,
      description: node.description,
      aliases: node.aliases,
      isCharacter: Boolean(character),
      images,
      relations,
      mentions: {
        moments,
        notes: mentionRows.filter((row) => row.kind === 'note').length,
        images: mentionRows.filter((row) => row.kind === 'image').length,
      },
    };
  });
}
