/* Запросы экрана «Хроника».
 *
 * Датасет кампании маленький, поэтому вместо одного большого джойна —
 * несколько простых выборок, склеенных в JS. Весь доступ к базе идёт через
 * runDb: PGlite держит одно соединение и не переживает параллельных запросов
 * (см. lib/db/client.ts). Страница спокойно делает Promise.all — очередь
 * разложит их по одному.
 */

import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import type { Viewer } from '@/lib/auth-shared';
import { visibleEntries } from '@/lib/visibility';

export type FeedFilter = 'all' | 'quotes' | 'fails' | 'loot';

export const FEED_FILTERS: { id: FeedFilter; label: string }[] = [
  { id: 'all', label: 'ВСЁ' },
  { id: 'quotes', label: 'ЦИТАТЫ' },
  { id: 'fails', label: 'ПРОВАЛЫ' },
  { id: 'loot', label: 'ЛУТ' },
];

export function isFeedFilter(value: string | undefined): value is FeedFilter {
  return FEED_FILTERS.some((f) => f.id === value);
}

export function getCampaign() {
  return runDb(async (db) => {
    const [row] = await db.select().from(t.campaigns).where(eq(t.campaigns.id, CAMPAIGN_ID));
    return row ?? null;
  });
}

/** Партия для hero: узел плюс раса и классы. */
export function getParty() {
  return runDb((db) =>
    db
      .select({
        id: t.nodes.id,
        name: t.nodes.name,
        slug: t.nodes.slug,
        race: t.characters.race,
        classes: t.characters.classes,
        portrait: t.characters.portrait,
      })
      .from(t.characters)
      .innerJoin(t.nodes, eq(t.nodes.id, t.characters.nodeId))
      .where(and(eq(t.nodes.campaignId, CAMPAIGN_ID), eq(t.characters.isPc, true)))
      .orderBy(t.nodes.name),
  );
}

/** Справочник для рендера [[ссылок]]: имя и алиасы в нижнем регистре → slug. */
export function getNodeIndex() {
  return runDb(async (db) => {
    const rows = await db
      .select({ name: t.nodes.name, slug: t.nodes.slug, aliases: t.nodes.aliases })
      .from(t.nodes)
      .where(eq(t.nodes.campaignId, CAMPAIGN_ID));

    const index = new Map<string, string>();
    for (const row of rows) {
      index.set(row.name.toLowerCase(), row.slug);
      for (const alias of row.aliases) index.set(alias.toLowerCase(), row.slug);
    }
    return index;
  });
}

export type FeedEntry = Awaited<ReturnType<typeof getFeed>>[number];

export function getFeed(filter: FeedFilter = 'all', viewer: Viewer | null = null) {
  return runDb(async (db) => {
    const visible = visibleEntries(viewer);
    const conditions = [
      eq(t.entries.campaignId, CAMPAIGN_ID),
      inArray(t.entries.kind, ['moment', 'quote'] as const),
      ...(visible ? [visible] : []),
    ];
    if (filter === 'quotes') conditions.push(eq(t.entries.kind, 'quote'));
    if (filter === 'fails') conditions.push(eq(t.entries.isFail, true));
    if (filter === 'loot') conditions.push(sql`${t.entries.tags} && ARRAY['#лут']::text[]`);

    const rows = await db
      .select({
        id: t.entries.id,
        kind: t.entries.kind,
        title: t.entries.title,
        body: t.entries.body,
        roll: t.entries.roll,
        isCrit: t.entries.isCrit,
        isFail: t.entries.isFail,
        tags: t.entries.tags,
        visibility: t.entries.visibility,
        authorId: t.entries.authorId,
        subjectId: t.entries.subjectId,
        createdAt: t.entries.createdAt,
        sessionId: t.entries.sessionId,
        sessionNumber: t.sessions.number,
        sessionTitle: t.sessions.title,
        authorName: t.users.name,
        subjectName: t.nodes.name,
        subjectSlug: t.nodes.slug,
      })
      .from(t.entries)
      .leftJoin(t.sessions, eq(t.sessions.id, t.entries.sessionId))
      .leftJoin(t.users, eq(t.users.id, t.entries.authorId))
      .leftJoin(t.nodes, eq(t.nodes.id, t.entries.subjectId))
      .where(and(...conditions))
      /* Внутри одной сессии — в порядке добавления, как в макете. */
      .orderBy(desc(t.entries.createdAt), asc(t.entries.id));

    if (rows.length === 0) {
      return [] as ((typeof rows)[number] & {
        image: { caption: string | null; url: string | null } | null;
        votes: number;
      })[];
    }

    const ids = rows.map((r) => r.id);

    const imageRows = await db
      .select({ entryId: t.images.entryId, caption: t.images.caption, url: t.images.url })
      .from(t.images)
      .where(inArray(t.images.entryId, ids));

    const voteRows = await db
      .select({ entryId: t.votes.entryId, count: sql<number>`count(*)::int` })
      .from(t.votes)
      .where(inArray(t.votes.entryId, ids))
      .groupBy(t.votes.entryId);

    const images = new Map(imageRows.map((r) => [r.entryId, r]));
    const votes = new Map(voteRows.map((r) => [r.entryId, r.count]));

    return rows.map((row) => ({
      ...row,
      image: images.get(row.id) ?? null,
      votes: votes.get(row.id) ?? 0,
    }));
  });
}

/** Список сессий в сайдбаре: последние сверху. */
export function getRecentSessions(limit = 5) {
  return runDb((db) =>
    db
      .select({
        id: t.sessions.id,
        number: t.sessions.number,
        title: t.sessions.title,
        date: t.sessions.date,
      })
      .from(t.sessions)
      .where(eq(t.sessions.campaignId, CAMPAIGN_ID))
      .orderBy(desc(t.sessions.number))
      .limit(limit),
  );
}

/** Активная сессия — последняя по номеру. К ней привязываются новые записи. */
export async function getActiveSession() {
  const [session] = await getRecentSessions(1);
  return session ?? null;
}

/** Карточки «ЗАМЕТКИ»: узлы со статусом плюс счётчик входящих связей.
 *
 * Считаем джойном, а не коррелированным подзапросом: в подзапросе Drizzle
 * рендерит ссылку на внешнюю колонку неквалифицированно, и `nodes.id`
 * резолвится в `links.id` — счётчик молча выходит нулевым. */
export function getStatusNodes(limit = 4) {
  return runDb((db) =>
    db
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
      .orderBy(t.nodes.status, desc(t.nodes.name))
      .limit(limit),
  );
}

/** Превью галереи в сайдбаре: последние кадры и общий счётчик. */
export function getGalleryPreview(limit = 5) {
  return runDb(async (db) => {
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(t.images)
      .where(eq(t.images.campaignId, CAMPAIGN_ID));

    const recent = await db
      .select({ id: t.images.id, caption: t.images.caption, url: t.images.url })
      .from(t.images)
      .where(eq(t.images.campaignId, CAMPAIGN_ID))
      .orderBy(desc(t.images.createdAt), desc(t.images.id))
      .limit(limit);

    return { total, recent };
  });
}

/** Превью доски: узлы с координатами и ручные рёбра между ними. */
export function getBoardPreview() {
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
      .where(eq(t.nodes.campaignId, CAMPAIGN_ID));

    const positioned = new Set(nodes.map((n) => n.id));

    const edgeRows = await db
      .select({ from: t.links.fromNodeId, to: t.links.toNodeId })
      .from(t.links)
      .where(and(eq(t.links.campaignId, CAMPAIGN_ID), eq(t.links.kind, 'manual')));

    /* Рёбра рисуются только между узлами, у которых есть координаты:
     * связи персонажей появятся на полной доске (этап 8). */
    const edges = edgeRows.filter(
      (e): e is { from: string; to: string } =>
        e.from !== null && positioned.has(e.from) && positioned.has(e.to),
    );

    return { nodes, edges };
  });
}
