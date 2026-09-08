/* Пересчёт рёбер-упоминаний.
 *
 * README: «Каждая [[ссылка]] создаёт ребро графа с типом mention; удаление
 * ссылки из текста удаляет ребро». Поэтому функция не добавляет рёбра, а
 * приводит их в соответствие тексту: чего нет в тексте — удаляется.
 *
 * Имена, которым не нашлось узла, молча пропускаются: сущности создаются
 * явно, опцией «+ создать» в редакторе, а не по факту опечатки в тексте.
 * Их список возвращается — вызывающий код может показать предупреждение.
 */

import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { parseWikiLinks } from './parse';

export type SyncResult = {
  added: string[];
  removed: string[];
  /** Имена из [[скобок]], которым не нашлось сущности. */
  unresolved: string[];
};

export async function syncEntryLinks(
  db: Db,
  campaignId: string,
  entryId: string,
  body: string | null,
): Promise<SyncResult> {
  const nodes = await db
    .select({ id: t.nodes.id, name: t.nodes.name, aliases: t.nodes.aliases })
    .from(t.nodes)
    .where(eq(t.nodes.campaignId, campaignId));

  const byName = new Map<string, string>();
  for (const node of nodes) {
    byName.set(node.name.toLowerCase(), node.id);
    for (const alias of node.aliases) byName.set(alias.toLowerCase(), node.id);
  }

  const wanted = new Set<string>();
  const unresolved: string[] = [];
  for (const name of parseWikiLinks(body ?? '')) {
    const nodeId = byName.get(name.toLowerCase());
    if (nodeId) wanted.add(nodeId);
    else if (!unresolved.includes(name)) unresolved.push(name);
  }

  const existing = await db
    .select({ id: t.links.id, toNodeId: t.links.toNodeId })
    .from(t.links)
    .where(and(eq(t.links.fromEntryId, entryId), eq(t.links.kind, 'mention')));

  const have = new Set(existing.map((row) => row.toNodeId));

  const staleIds = existing.filter((row) => !wanted.has(row.toNodeId)).map((row) => row.id);
  if (staleIds.length > 0) {
    await db.delete(t.links).where(inArray(t.links.id, staleIds));
  }

  const added = [...wanted].filter((nodeId) => !have.has(nodeId));
  if (added.length > 0) {
    await db.insert(t.links).values(
      added.map((nodeId) => ({
        id: `l-mention-${entryId}-${nodeId}`,
        campaignId,
        kind: 'mention' as const,
        fromNodeId: null,
        fromEntryId: entryId,
        toNodeId: nodeId,
      })),
    );
  }

  return {
    added,
    removed: existing.filter((row) => !wanted.has(row.toNodeId)).map((row) => row.toNodeId),
    unresolved,
  };
}
