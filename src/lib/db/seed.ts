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
 *   — СТАТУСЫ всех сущностей и ТИПЫ всех, кроме Стоунфеллоу (он NPC — подтверждено);
 *   — тексты моментов и цитат целиком;
 *   — названия сессий (Алекс их не давал — оставлены пустыми);
 *   — подписи изображений, ярлыки ручных связей, координаты узлов доски.
 */

import { hash } from '@node-rs/argon2';
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
const PARTY: (NodeSeed & { race: string; classes: string; bio: string })[] = [
  {
    id: 'n-aelis',
    kind: 'character',
    name: 'Аэлис',
    race: 'Дженази',
    classes: 'Плут · Монах',
    x: 30,
    y: 62,
    bio: 'Держит дистанцию со всеми, кроме партии, и не любит разговоров про свою семью.',
  },
  {
    id: 'n-jadu',
    kind: 'character',
    name: 'Джаду',
    race: 'Табакси',
    classes: 'Волшебник',
    x: 28,
    y: 20,
    bio: 'Считает, что любой предмет считается за один, если его правильно упаковать.',
  },
  {
    id: 'n-metel',
    kind: 'character',
    name: 'Метель',
    race: 'Тифлинг',
    classes: 'Плут',
    x: 60,
    y: 40,
    bio: 'Ведёт переговоры как бой и обычно выходит из них с чужим имуществом.',
  },
  {
    id: 'n-ogen',
    kind: 'character',
    name: 'Оген',
    race: 'Дженази',
    classes: 'Плут · Чародей',
    x: 84,
    y: 46,
    bio: 'Задаёт вопросы, ответы на которые никому не нравятся, и всё равно оказывается прав.',
  },
];

/* Девять сущностей Алекса. Статусы — догадки, поправь.
 * Типы тоже догадки, кроме Стоунфеллоу: он NPC, подтверждено. */
const ENTITIES: NodeSeed[] = [
  {
    id: 'n-tavern',
    kind: 'location',
    name: 'Та Самая Таверна',
    status: 'resolved',
    x: 46,
    y: 44,
    description: 'Место, где партия собирается между вылазками и куда стекаются слухи.',
  },
  {
    id: 'n-stonefellow',
    kind: 'npc',
    name: 'Стоунфеллоу',
    status: 'open',
    x: 74,
    y: 20,
    description: 'Знает о партии больше, чем должен. Чем именно занят — пока не выяснено.',
  },
  {
    id: 'n-tears',
    kind: 'artifact',
    name: 'Слёзы Мирабеллы',
    status: 'open',
    x: 44,
    y: 14,
    description: 'Семь артефактов, исполняющих желания. Шесть ещё не найдены.',
  },
  {
    id: 'n-jaddu',
    kind: 'location',
    name: 'Город Джадду',
    status: 'resolved',
    x: 16,
    y: 30,
    description: 'Город, откуда тянется след Дамайи и куда ведёт часть старых связей.',
  },
  {
    id: 'n-sugar',
    kind: 'npc',
    name: 'Шугар-дэдди Метели',
    status: 'open',
    x: 72,
    y: 62,
    description: 'Покровитель Метели. Ведёт учёт всему, что за ней числится.',
  },
  {
    id: 'n-father',
    kind: 'npc',
    name: 'Отец Аэлиса',
    status: 'open',
    x: 20,
    y: 76,
    description: 'О нём известно немного, и Аэлис не спешит рассказывать.',
  },
  {
    id: 'n-anderksot',
    kind: 'location',
    name: 'Горы Андерксот',
    status: 'open',
    x: 12,
    y: 56,
    description: 'Горная гряда, откуда партия вынесла содержимое сундука.',
  },
  {
    id: 'n-pearl',
    kind: 'event',
    name: 'Экспедиция за жемчужиной',
    status: 'open',
    x: 60,
    y: 84,
    description: 'Незакрытое предприятие, к которому так или иначе сходится половина зацепок.',
  },
  {
    id: 'n-damaya',
    kind: 'npc',
    name: 'Дамайя',
    status: 'dead_end',
    x: 40,
    y: 70,
    description: 'След оборвался в Городе Джадду. Ждём нового имени.',
  },
];

/* Ручные связи. Ярлыки — заглушки. */
const MANUAL_LINKS: [from: string, to: string, label: string][] = [
  ['n-pearl', 'n-tears', 'Цель'],
  ['n-pearl', 'n-anderksot', 'Маршрут'],
  ['n-metel', 'n-sugar', 'Долг'],
  ['n-metel', 'n-stonefellow', 'Вражда'],
  ['n-metel', 'n-ogen', 'Напарник'],
  ['n-metel', 'n-tears', 'Тайна'],
  ['n-aelis', 'n-father', 'Родство'],
  ['n-tavern', 'n-stonefellow', 'Завсегдатай'],
  ['n-damaya', 'n-jaddu', 'След'],
  ['n-jadu', 'n-jaddu', 'Родина'],
  ['n-tears', 'n-damaya', 'Подозрение'],
  ['n-ogen', 'n-pearl', 'Участник'],
  ['n-aelis', 'n-tavern', 'Завсегдатай'],
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
  /** По умолчанию public; 'private' — личная заметка персонажа. */
  visibility?: t.Visibility;
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
    id: 'e-26-3',
    kind: 'quote',
    session: 26,
    body: 'Он назвал меня по имени. Значит, кто-то уже назвал ему моё.',
    author: 'u-metel',
    subject: 'n-metel',
  },
  {
    id: 'e-25-3',
    kind: 'quote',
    session: 25,
    body: 'Это не мародёрство, это инвентаризация.',
    author: 'u-jadu',
    subject: 'n-jadu',
  },
  {
    id: 'e-24-3',
    kind: 'quote',
    session: 24,
    body: 'У меня нет плана. У меня есть последовательность решений.',
    author: 'u-dm',
  },
  {
    id: 'e-26-note',
    kind: 'note',
    session: 26,
    body: 'Проверить, кто мог назвать [[Стоунфеллоу]] имя Метели. Начать с [[Та Самая Таверна]].',
    author: 'u-jadu',
  },
  {
    id: 'e-25-note',
    kind: 'note',
    session: 25,
    body: 'Опись из [[Горы Андерксот]] сверить с тем, что числится за [[Шугар-дэдди Метели]].',
    author: 'u-jadu',
  },
  {
    id: 'e-26-private',
    kind: 'note',
    session: 26,
    body: 'Не рассказывать партии про счёт от покровителя, пока не пойму, чем он обеспечен.',
    author: 'u-metel',
    subject: 'n-metel',
    visibility: 'private',
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

/** Пароль для всех учёток сида. Задаётся через SEED_PASSWORD;
 *  значение по умолчанию — только для локальной разработки. */
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'мирабелла';

export async function seed(db: Db) {
  const passwordHash = await hash(SEED_PASSWORD);

  await db.insert(t.users).values([
    { id: 'u-aelis', name: 'Аэлис', initial: 'А', role: 'player', passwordHash },
    { id: 'u-jadu', name: 'Джаду', initial: 'Д', role: 'player', passwordHash },
    { id: 'u-metel', name: 'Метель', initial: 'М', role: 'player', passwordHash },
    { id: 'u-ogen', name: 'Оген', initial: 'О', role: 'player', passwordHash },
    { id: 'u-dm', name: 'Мастер', initial: 'М', role: 'dm', passwordHash },
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
      bio: c.bio,
      isPc: true,
      playerId: `u-${c.id.slice(2)}`,
      sinceSession: 1,
    })),
  );

  await db
    .insert(t.boardPositions)
    .values(
      allNodes
        .filter((n) => n.x !== undefined)
        .map((n) => ({ nodeId: n.id, x: n.x as number, y: n.y as number })),
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
      visibility: e.visibility ?? ('public' as const),
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
    { entryId: 'e-26-2', userId: 'u-dm' },
    { entryId: 'e-26-3', userId: 'u-ogen' },
    { entryId: 'e-26-3', userId: 'u-jadu' },
    { entryId: 'e-24-1', userId: 'u-ogen' },
    { entryId: 'e-25-3', userId: 'u-metel' },
  ]);

  await db.execute(sql`select 1`);
}

export { CAMPAIGN_ID, SESSION_COUNT };
