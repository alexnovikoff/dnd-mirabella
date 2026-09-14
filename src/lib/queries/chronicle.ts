/* Запросы экрана «Хроника».
 *
 * Датасет кампании маленький, поэтому вместо одного большого джойна —
 * несколько простых выборок, склеенных в JS. Весь доступ к базе идёт через
 * runDb: PGlite держит одно соединение и не переживает параллельных запросов
 * (см. lib/db/client.ts). Страница спокойно делает Promise.all — очередь
 * разложит их по одному.
 */

import { and, asc, desc, eq, inArray, isNotNull, not, notInArray, sql } from 'drizzle-orm';
import { runDb, type Db } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import type { Viewer } from '@/lib/auth-shared';
import { LOOT_TAG } from '@/lib/entries-shared';
import { visibleEntries } from '@/lib/visibility';
import { parseWikiLinks } from '@/lib/wiki/parse';

export type FeedFilter = 'all' | 'moments' | 'quotes' | 'loot';

export const FEED_FILTERS: { id: FeedFilter; label: string }[] = [
  { id: 'all', label: 'ВСЁ' },
  { id: 'moments', label: 'МОМЕНТЫ' },
  { id: 'quotes', label: 'ЦИТАТЫ' },
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

/** Миниатюра карточки ленты: только кадр с файлом, штриховки вместо него нет. */
export type FeedThumbnail = { url: string; alt: string };

export function getFeed(filter: FeedFilter = 'all', viewer: Viewer | null = null) {
  return runDb(async (db) => {
    const visible = visibleEntries(viewer);
    const conditions = [
      eq(t.entries.campaignId, CAMPAIGN_ID),
      inArray(t.entries.kind, ['moment', 'quote'] as const),
      ...(visible ? [visible] : []),
    ];
    const isLoot = sql`${t.entries.tags} && ARRAY[${LOOT_TAG}]::text[]`;
    /* Лут — тоже момент, но у него свой фильтр: в «моментах» он не дублируется. */
    if (filter === 'moments') conditions.push(eq(t.entries.kind, 'moment'), not(isLoot));
    if (filter === 'quotes') conditions.push(eq(t.entries.kind, 'quote'));
    if (filter === 'loot') conditions.push(isLoot);

    const rows = await db
      .select({
        id: t.entries.id,
        kind: t.entries.kind,
        title: t.entries.title,
        body: t.entries.body,
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
        thumbnail: FeedThumbnail | null;
      })[];
    }

    const ids = rows.map((r) => r.id);

    const imageRows = await db
      .select({ entryId: t.images.entryId, caption: t.images.caption, url: t.images.url })
      .from(t.images)
      .where(inArray(t.images.entryId, ids));

    const images = new Map(imageRows.map((r) => [r.entryId, r]));

    const mentionRows = await db
      .select({
        entryId: t.links.fromEntryId,
        nodeId: t.nodes.id,
        name: t.nodes.name,
        aliases: t.nodes.aliases,
        portrait: t.characters.portrait,
      })
      .from(t.links)
      .innerJoin(t.nodes, eq(t.nodes.id, t.links.toNodeId))
      .leftJoin(t.characters, eq(t.characters.nodeId, t.nodes.id))
      .where(and(eq(t.links.kind, 'mention'), inArray(t.links.fromEntryId, ids)));

    const nodeImages = await mentionedNodeImages(db, mentionRows);

    /* Упомянутые узлы записи по имени и прежним именам — так же, как их
     * резолвит syncEntryLinks: порядок берётся из текста, а у рёбер его нет. */
    const mentions = new Map<string, Map<string, (typeof mentionRows)[number]>>();
    for (const mention of mentionRows) {
      if (!mention.entryId) continue;
      const byName = mentions.get(mention.entryId) ?? new Map();
      byName.set(mention.name.toLowerCase(), mention);
      for (const alias of mention.aliases) byName.set(alias.toLowerCase(), mention);
      mentions.set(mention.entryId, byName);
    }

    /* Свой кадр записи — первым: его приложили именно к этому моменту. Иначе
     * кадр первого узла из [[ссылок]], у которого он есть. Узлы без кадра
     * пропускаются: пустая штриховка в ленте ничего не иллюстрирует. */
    function thumbnailOf(row: (typeof rows)[number]): FeedThumbnail | null {
      const own = images.get(row.id);
      if (own?.url) return { url: own.url, alt: own.caption ?? '' };

      const byName = mentions.get(row.id);
      if (!byName || !row.body) return null;
      for (const name of parseWikiLinks(row.body)) {
        const mention = byName.get(name.toLowerCase());
        const url = mention ? nodeImages.get(mention.nodeId) : undefined;
        if (mention && url) return { url, alt: mention.name };
      }
      return null;
    }

    return rows.map((row) => ({
      ...row,
      image: images.get(row.id) ?? null,
      thumbnail: thumbnailOf(row),
    }));
  });
}

/** Кадр узла, как в панели доски: у персонажа портрет, у остальных и у
 *  персонажа без портрета — самый свежий кадр карточки с файлом. */
async function mentionedNodeImages(
  db: Db,
  mentions: { nodeId: string; portrait: string | null }[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (const mention of mentions) {
    if (mention.portrait) result.set(mention.nodeId, mention.portrait);
  }

  const rest = [...new Set(mentions.map((m) => m.nodeId))].filter((id) => !result.has(id));
  if (rest.length === 0) return result;

  /* Достижения тоже привязаны к узлу, поэтому вид проверяем явно. */
  const entityImages = await db
    .select({ nodeId: t.images.nodeId, url: t.images.url })
    .from(t.images)
    .where(
      and(inArray(t.images.nodeId, rest), eq(t.images.kind, 'entity'), isNotNull(t.images.url)),
    )
    .orderBy(desc(t.images.createdAt), desc(t.images.id));

  for (const image of entityImages) {
    if (image.nodeId && image.url && !result.has(image.nodeId)) {
      result.set(image.nodeId, image.url);
    }
  }
  return result;
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

/** Превью галереи в сайдбаре: последние кадры и общий счётчик.
 *
 * Кадры узлов отсечены так же, как на экране «Галерея»: заголовок виджета
 * ведёт туда, и счётчик с плитками не должны обещать больше, чем там лежит. */
export function getGalleryPreview(limit = 5) {
  return runDb(async (db) => {
    const scope = and(
      eq(t.images.campaignId, CAMPAIGN_ID),
      notInArray(t.images.kind, t.NODE_IMAGE_KINDS),
    );

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(t.images)
      .where(scope);

    const recent = await db
      .select({ id: t.images.id, caption: t.images.caption, url: t.images.url })
      .from(t.images)
      .where(scope)
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

    /* id и тип ребра нужны превью: если пару перетащили друг на друга
     * повторно, окно правит существующую связь, а не заводит вторую. */
    const edgeRows = await db
      .select({
        id: t.links.id,
        from: t.links.fromNodeId,
        to: t.links.toNodeId,
        label: t.links.label,
      })
      .from(t.links)
      .where(and(eq(t.links.campaignId, CAMPAIGN_ID), eq(t.links.kind, 'manual')));

    /* Рёбра рисуются только между узлами, у которых есть координаты:
     * связи персонажей появятся на полной доске (этап 8). */
    const edges = edgeRows.filter(
      (e): e is { id: string; from: string; to: string; label: string | null } =>
        e.from !== null && positioned.has(e.from) && positioned.has(e.to),
    );

    return { nodes, edges };
  });
}
