/* Пересчёт рёбер-упоминаний.
 *
 * README: «Каждая [[ссылка]] создаёт ребро графа с типом mention; удаление
 * ссылки из текста удаляет ребро». Поэтому функция не добавляет рёбра, а
 * приводит их в соответствие тексту: чего нет в тексте — удаляется.
 *
 * Источников текста два, и оба равноправны: тело записи и описание сессии.
 * Общий код один, различается только колонка, в которой ребро помнит, откуда
 * оно взялось, — поэтому наружу торчат две тонкие обёртки.
 *
 * Имена, которым не нашлось узла, молча пропускаются: сущности создаются
 * явно, опцией «+ создать» в редакторе, а не по факту опечатки в тексте.
 * Их список возвращается — вызывающий код может показать предупреждение.
 */

import { and, eq, inArray, type SQL } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { parseWikiLinks } from './parse';

export type SyncResult = {
  added: string[];
  removed: string[];
  /** Имена из [[скобок]], которым не нашлось сущности. */
  unresolved: string[];
};

/** Откуда взялось ребро: тело записи или описание сессии. */
export type LinkSource = { entryId: string } | { sessionId: string };

/** Как источник ищет свои рёбра и как подписывает новые. */
function sourceOf(source: LinkSource): {
  where: SQL;
  columns: { fromEntryId: string | null; fromSessionId: string | null };
  idPrefix: string;
} {
  return 'entryId' in source
    ? {
        where: eq(t.links.fromEntryId, source.entryId),
        columns: { fromEntryId: source.entryId, fromSessionId: null },
        idPrefix: `l-mention-${source.entryId}`,
      }
    : {
        where: eq(t.links.fromSessionId, source.sessionId),
        columns: { fromEntryId: null, fromSessionId: source.sessionId },
        /* Отдельный префикс: id сессии и id записи — оба uuid, и без него
         * ключи двух источников теоретически сходятся. */
        idPrefix: `l-mention-session-${source.sessionId}`,
      };
}

export async function syncLinks(
  db: Db,
  campaignId: string,
  source: LinkSource,
  body: string | null,
): Promise<SyncResult> {
  const from = sourceOf(source);

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
    .where(and(from.where, eq(t.links.kind, 'mention')));

  const have = new Set(existing.map((row) => row.toNodeId));

  const staleIds = existing.filter((row) => !wanted.has(row.toNodeId)).map((row) => row.id);
  if (staleIds.length > 0) {
    await db.delete(t.links).where(inArray(t.links.id, staleIds));
  }

  const added = [...wanted].filter((nodeId) => !have.has(nodeId));
  if (added.length > 0) {
    await db.insert(t.links).values(
      added.map((nodeId) => ({
        id: `${from.idPrefix}-${nodeId}`,
        campaignId,
        kind: 'mention' as const,
        fromNodeId: null,
        ...from.columns,
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

/** Рёбра записи: момент, цитата, заметка. */
export function syncEntryLinks(
  db: Db,
  campaignId: string,
  entryId: string,
  body: string | null,
): Promise<SyncResult> {
  return syncLinks(db, campaignId, { entryId }, body);
}

/** Рёбра описания сессии — пересказа игры своими словами. */
export function syncSessionLinks(
  db: Db,
  campaignId: string,
  sessionId: string,
  description: string | null,
): Promise<SyncResult> {
  return syncLinks(db, campaignId, { sessionId }, description);
}
