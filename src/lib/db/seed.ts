/* Сид кампании.
 *
 * ЧТО ЗДЕСЬ НАСТОЯЩЕЕ (дал Алекс / README хендоффа):
 *   — партия: Аэлис, Джаду, Метель, Оген, их расы и классы;
 *   — 26 сессий;
 *   — девять сущностей: Та Самая Таверна, Стоунфеллоу, Слёзы Мирабеллы,
 *     Город Джадду, Шугар-дэдди Метели, Отец Аэлиса, Горы Андерксот,
 *     Экспедиция за жемчужиной, Дамайя;
 *   — название, сеттинг и лид кампании.
 *
 * ЧТО ЗАГЛУШКИ (придумано, чтобы экран было на чём собрать, — заменить):
 *   — ТИПЫ и СТАТУСЫ сущностей: догадки, особенно «Стоунфеллоу»;
 *   — тексты моментов и цитат целиком;
 *   — названия сессий (Алекс их не давал — оставлены пустыми);
 *   — подписи изображений, ярлыки ручных связей, координаты узлов доски.
 */

import { sql } from 'drizzle-orm';
import type { Db } from './client';
import * as t from './schema';
import { slugify } from '../slug';
import { parseWikiLinks } from '../wiki/parse';

const CAMPAIGN_ID = 'campaign-mirabella';

/** Дата последней сессии; предыдущие — на неделю раньше каждая. */
const LAST_SESSION_DATE = new Date('2026-09-06T19:00:00Z');
const SESSION_COUNT = 26;

const iso = (d: Date) => d.toISOString().slice(0, 10);

function sessionDate(number: number): Date {
  const weeksBack = SESSION_COUNT - number;
  return new Date(LAST_SESSION_DATE.getTime() - weeksBack * 7 * 24 * 3600 * 1000);
}

type NodeSeed = {
  id: string;
  kind: t.NodeKind;
  name: string;
  status?: t.NodeStatus;
  description?: string;
  x?: number;
  y?: number;
};

/* Партия — данные из README хендоффа. */
const PARTY: (NodeSeed & { race: string; classes: string })[] = [
  { id: 'n-aelis', kind: 'character', name: 'Аэлис', race: 'Дженази', classes: 'Плут · Монах' },
  { id: 'n-jadu', kind: 'character', name: 'Джаду', race: 'Табакси', classes: 'Волшебник' },
  { id: 'n-metel', kind: 'character', name: 'Метель', race: 'Тифлинг', classes: 'Плут' },
  { id: 'n-ogen', kind: 'character', name: 'Оген', race: 'Дженази', classes: 'Плут · Чародей' },
];

/* Девять сущностей Алекса. Тип и статус — догадки, поправь. */
const ENTITIES: NodeSeed[] = [
  { id: 'n-tavern', kind: 'location', name: 'Та Самая Таверна', status: 'resolved', x: 46, y: 44 },
  { id: 'n-stonefellow', kind: 'npc', name: 'Стоунфеллоу', status: 'open', x: 74, y: 20 },
  { id: 'n-tears', kind: 'artifact', name: 'Слёзы Мирабеллы', status: 'open', x: 44, y: 14 },
  { id: 'n-jaddu', kind: 'location', name: 'Город Джадду', status: 'resolved', x: 16, y: 30 },
  { id: 'n-sugar', kind: 'npc', name: 'Шугар-дэдди Метели', status: 'open', x: 72, y: 62 },
  { id: 'n-father', kind: 'npc', name: 'Отец Аэлиса', status: 'open', x: 20, y: 76 },
  { id: 'n-anderksot', kind: 'location', name: 'Горы Андерксот', status: 'open', x: 12, y: 56 },
  { id: 'n-pearl', kind: 'event', name: 'Экспедиция за жемчужиной', status: 'open', x: 60, y: 84 },
  { id: 'n-damaya', kind: 'npc', name: 'Дамайя', status: 'dead_end', x: 40, y: 70 },
];

/* Ручные связи. Ярлыки — заглушки. */
const MANUAL_LINKS: [from: string, to: string, label: string][] = [
  ['n-pearl', 'n-tears', 'Цель'],
  ['n-pearl', 'n-anderksot', 'Маршрут'],
  ['n-metel', 'n-sugar', 'Покровитель'],
  ['n-aelis', 'n-father', 'Родство'],
  ['n-tavern', 'n-stonefellow', 'Завсегдатай'],
  ['n-damaya', 'n-jaddu', 'След'],
  ['n-jadu', 'n-jaddu', 'Родина'],
  ['n-tears', 'n-damaya', 'Подозрение'],
];

/* Лента. Тексты придуманы — заменить настоящими. */
type EntrySeed = {
  id: string;
  kind: t.EntryKind;
  session: number;
  title?: string;
  body: string;
  author: string;
  subject?: string;
  roll?: number;
  isCrit?: boolean;
  isFail?: boolean;
  tags?: string[];
};

const ENTRIES: EntrySeed[] = [
  {
    id: 'e-26-1',
    kind: 'moment',
    session: 26,
    title: 'Стоунфеллоу узнал Метель раньше, чем она его',
    body: 'Разговор в [[Та Самая Таверна]] начался с того, что [[Стоунфеллоу]] назвал [[Метель]] по имени, которого она здесь не называла. К концу вечера мы знали про [[Экспедиция за жемчужиной]] больше, чем собирались спрашивать.',
    author: 'u-metel',
    subject: 'n-metel',
    roll: 20,
    isCrit: true,
    tags: ['#метель', '#стоунфеллоу', '#таверна'],
  },
  {
    id: 'e-26-2',
    kind: 'quote',
    session: 26,
    body: 'Я не спрашиваю, чья это жемчужина. Я спрашиваю, чья она будет.',
    author: 'u-ogen',
    subject: 'n-ogen',
  },
  {
    id: 'e-25-1',
    kind: 'moment',
    session: 25,
    title: 'Опись сундука заняла больше времени, чем сам сундук',
    body: 'Из [[Горы Андерксот]] мы вынесли ровно столько, сколько смогли унести, и ещё немного сверху — [[Джаду]] считает, что вторая половина ящика тоже считается за один предмет.',
    author: 'u-jadu',
    subject: 'n-jadu',
    tags: ['#лут', '#андерксот'],
  },
  {
    id: 'e-25-2',
    kind: 'moment',
    session: 25,
    title: 'След Дамайи оборвался на третьем перекрёстке',
    body: 'Всё, что вело к [[Дамайя]], закончилось в [[Город Джадду]] пустым домом и хозяином, который о ней не слышал. Пишем в тупики, пока не появится новое имя.',
    author: 'u-aelis',
    subject: 'n-aelis',
    roll: 1,
    isFail: true,
    tags: ['#дамайя', '#тупик'],
  },
  {
    id: 'e-24-1',
    kind: 'quote',
    session: 24,
    body: 'Мой отец говорил: не бери в долг у того, кто улыбается. Я взяла у двоих.',
    author: 'u-aelis',
    subject: 'n-aelis',
  },
  {
    id: 'e-24-2',
    kind: 'moment',
    session: 24,
    title: 'Шугар-дэдди прислал счёт',
    body: 'Оказалось, что [[Шугар-дэдди Метели]] ведёт учёт. [[Слёзы Мирабеллы]] в списке значатся отдельной строкой, и это первый раз, когда мы видим их написанными чужой рукой.',
    author: 'u-metel',
    subject: 'n-metel',
    tags: ['#метель', '#слёзы'],
  },
];

/* Подписи изображений — заглушки, файлов ещё нет. */
const IMAGES: {
  id: string;
  session: number;
  caption: string;
  kind: 'art' | 'map' | 'screenshot';
  uploader: string;
  isKey?: boolean;
  entry?: string;
}[] = [
  {
    id: 'i-1',
    session: 26,
    caption: 'Та Самая Таверна · интерьер',
    kind: 'art',
    uploader: 'u-metel',
    isKey: true,
    entry: 'e-26-1',
  },
  { id: 'i-2', session: 26, caption: 'Стоунфеллоу · портрет', kind: 'art', uploader: 'u-dm' },
  { id: 'i-3', session: 26, caption: 'Карта квартала', kind: 'map', uploader: 'u-dm' },
  {
    id: 'i-4',
    session: 25,
    caption: 'Горы Андерксот · панорама',
    kind: 'art',
    uploader: 'u-jadu',
    isKey: true,
    entry: 'e-25-1',
  },
  { id: 'i-5', session: 25, caption: 'Опись сундука', kind: 'screenshot', uploader: 'u-jadu' },
  { id: 'i-6', session: 25, caption: 'Перевал · карта', kind: 'map', uploader: 'u-dm' },
  {
    id: 'i-7',
    session: 24,
    caption: 'Город Джадду · улица',
    kind: 'art',
    uploader: 'u-aelis',
    isKey: true,
  },
  {
    id: 'i-8',
    session: 24,
    caption: 'Счёт от покровителя',
    kind: 'screenshot',
    uploader: 'u-metel',
  },
];

export async function seed(db: Db) {
  await db.insert(t.users).values([
    { id: 'u-aelis', name: 'Аэлис', initial: 'А', role: 'player' },
    { id: 'u-jadu', name: 'Джаду', initial: 'Д', role: 'player' },
    { id: 'u-metel', name: 'Метель', initial: 'М', role: 'player' },
    { id: 'u-ogen', name: 'Оген', initial: 'О', role: 'player' },
    { id: 'u-dm', name: 'Мастер', initial: 'М', role: 'dm' },
  ]);

  await db.insert(t.campaigns).values({
    id: CAMPAIGN_ID,
    title: 'Слёзы Мирабеллы',
    seal: 'М',
    setting: 'Пустынно-восточный',
    eyebrow: `Дневник партии · ${SESSION_COUNT} сессий`,
    tagline:
      'Семь артефактов, исполняющих желания. Шесть ещё не найдены, а первую мы, кажется, уже потратили не туда.',
  });

  const sessionRows = Array.from({ length: SESSION_COUNT }, (_, i) => {
    const number = i + 1;
    return {
      id: `s-${number}`,
      campaignId: CAMPAIGN_ID,
      number,
      date: iso(sessionDate(number)),
      title: null,
      location: null,
    };
  });
  await db.insert(t.sessions).values(sessionRows);

  const allNodes = [...PARTY, ...ENTITIES];
  await db.insert(t.nodes).values(
    allNodes.map((n) => ({
      id: n.id,
      campaignId: CAMPAIGN_ID,
      kind: n.kind,
      name: n.name,
      slug: slugify(n.name),
      description: n.description ?? null,
      status: n.status ?? null,
      aliases: [],
    })),
  );

  await db.insert(t.characters).values(
    PARTY.map((c) => ({
      nodeId: c.id,
      race: c.race,
      classes: c.classes,
      isPc: true,
      playerId: `u-${c.id.slice(2)}`,
      sinceSession: 1,
    })),
  );

  await db.insert(t.boardPositions).values(
    ENTITIES.filter((e) => e.x !== undefined).map((e) => ({
      nodeId: e.id,
      x: e.x as number,
      y: e.y as number,
    })),
  );

  await db.insert(t.entries).values(
    ENTRIES.map((e) => ({
      id: e.id,
      campaignId: CAMPAIGN_ID,
      sessionId: `s-${e.session}`,
      kind: e.kind,
      title: e.title ?? null,
      body: e.body,
      authorId: e.author,
      subjectId: e.subject ?? null,
      roll: e.roll ?? null,
      isCrit: e.isCrit ?? false,
      isFail: e.isFail ?? false,
      tags: e.tags ?? [],
      visibility: 'public' as const,
      createdAt: sessionDate(e.session),
    })),
  );

  await db.insert(t.images).values(
    IMAGES.map((im) => ({
      id: im.id,
      campaignId: CAMPAIGN_ID,
      sessionId: `s-${im.session}`,
      entryId: im.entry ?? null,
      url: null,
      caption: im.caption,
      uploaderId: im.uploader,
      kind: im.kind,
      isKey: im.isKey ?? false,
      createdAt: sessionDate(im.session),
    })),
  );

  /* Ручные рёбра. */
  await db.insert(t.links).values(
    MANUAL_LINKS.map(([from, to, label], i) => ({
      id: `l-manual-${i}`,
      campaignId: CAMPAIGN_ID,
      kind: 'manual' as const,
      fromNodeId: from,
      fromEntryId: null,
      toNodeId: to,
      label,
    })),
  );

  /* Рёбра-упоминания: ровно то, что этап 4 будет пересчитывать при сохранении
   * записи. Здесь считаем один раз по тем же правилам. */
  const byName = new Map(allNodes.map((n) => [n.name.toLowerCase(), n.id]));
  const mentions: (typeof t.links.$inferInsert)[] = [];
  for (const entry of ENTRIES) {
    const seen = new Set<string>();
    for (const name of parseWikiLinks(entry.body)) {
      const nodeId = byName.get(name.toLowerCase());
      if (!nodeId || seen.has(nodeId)) continue;
      seen.add(nodeId);
      mentions.push({
        id: `l-mention-${entry.id}-${nodeId}`,
        campaignId: CAMPAIGN_ID,
        kind: 'mention',
        fromNodeId: null,
        fromEntryId: entry.id,
        toNodeId: nodeId,
      });
    }
  }
  if (mentions.length > 0) await db.insert(t.links).values(mentions);

  /* Голоса за цитаты — чтобы «♦ N» было не нулём. */
  await db.insert(t.votes).values([
    { entryId: 'e-26-2', userId: 'u-aelis' },
    { entryId: 'e-26-2', userId: 'u-jadu' },
    { entryId: 'e-26-2', userId: 'u-metel' },
    { entryId: 'e-24-1', userId: 'u-ogen' },
  ]);

  await db.execute(sql`select 1`);
}

export { CAMPAIGN_ID, SESSION_COUNT };
