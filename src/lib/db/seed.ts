/* Сид кампании.
 *
 * ЧТО ЗДЕСЬ НАСТОЯЩЕЕ (дал Алекс / README хендоффа):
 *   — партия: Аэлис, Джаду, Метель, Оген, их расы и классы;
 *   — 26 сессий и их заголовки;
 *   — девять сущностей: Та Самая Таверна, Стоунфеллоу, Слёзы Мирабеллы,
 *     Город Джадду, Шугар-дэдди Метели, Отец Аэлиса, Горы Андерксот,
 *     Экспедиция за жемчужиной, Дамайя;
 *   — цитатник;
 *   — название, сеттинг и лид кампании.
 *
 * ЧТО ЗАГЛУШКИ (придумано, чтобы экран было на чём собрать, — заменить):
 *   — СТАТУСЫ всех сущностей и ТИПЫ всех, кроме Стоунфеллоу (он NPC — подтверждено);
 *   — координаты узлов доски и ярлыки ручных связей.
 *
 * ЧЕГО ЗДЕСЬ НЕТ НАМЕРЕННО: моментов, заметок и изображений. Придуманные
 * тексты убраны — сессии стоят пустыми, пока в них не запишут настоящее.
 * Дат сессий Алекс не давал: прежние были посчитаны формулой «по неделе на
 * сессию», поэтому тоже убраны. Дату ставит мастер на странице сессии.
 */

import { hash } from '@node-rs/argon2';
import type { Db } from './client';
import * as t from './schema';
import { slugify } from '../slug';

const CAMPAIGN_ID = 'campaign-mirabella';

const SESSION_COUNT = 26;

/** Общая отметка времени для засеянных записей: порядок в ленте
 *  должен быть предсказуемым, а к сессиям цитаты не привязаны. */
const SEEDED_AT = new Date('2026-09-06T19:00:00Z');

/* Заголовки сессий — со слов Алекса, слово в слово. Номер в заголовке не
 * повторяем: и список, и страница сессии печатают его сами. Сессии 14, 17,
 * 20 и 23 остались без названия — их Алекс не назвал. */
const SESSION_TITLES: Record<number, string> = {
  1: 'Мы хотели ограбить Фариду, но вместо этого нанялись к ней на работу)',
  2: 'Мы стали опытнее, подготовились, разнюхали немного информации о Фариде и караван отправился в путь',
  3: 'День и ночь в переходе по пустыне. Домик гиен и засада в ущелье',
  4: 'Переход по пустыне. Ауф. (без голоса Джаду 🥲). Таверна, знакомство с Сальмой, строим планы',
  5: 'Исследуем город и готовимся к конкурсам. Не участвуем в конкурсах, к которым подготовились, а вместо этого спасаем Сальму, которая ничего не крала. И это даже правда',
  6: 'Расследование и бой с мусорным монстром',
  7: 'Слеза Мирабеллы: Сайдквест. Любовные похождения Аэлиса смотреть без регистрации, заказ на магический предмет и пещера торговцев',
  8: 'Слеза Мирабеллы: Город в бутылке. Часть 2. Бой с Триадой. Ночёвка в пустыне. Сбор информации. Оген пропал!',
  9: 'М сайдквест, часть 3. Попадаем на остров в бутылке. Дребезги витрин и тарелок, маяк',
  10: 'Остров в бутылке - финал',
  11: 'Тайны «Серебряной стрелы»',
  12: 'Слеза Мирабеллы, сессия 8. Лучик отправился с нами. Мы рассказывали истории и спорили, какое желание загадаем',
  13: 'Получили телепортационный кувшин, познакомились с Леомарисом, спасли дураков-студентов, вызвали «торговцев» на стрелку, они оказались лучшими торговцами, чем мы, Аэлис пал, но ещё вернётся... враг силён, но мы ещё отомстим',
  15: 'Рыболюды, очень безопасная рыба и две девули на корабле',
  16: 'Морское путешествие и возвращение в Шайнинг Вейв',
  18: 'Путешествие на остров',
  19: 'Приквел, ограбили золотое хранилище, подменили статуэтку, вынесли много монет и свалили с помощью кувшина',
  21: 'Во имя любви',
  22: 'Сражение в подводном городе перий',
  24: 'Награды, покупки, поиски информации, сквер потерянных вещей',
  25: 'Магические лабиринты',
  26: 'Допрошли переулок и собираемся в экспедицию',
};

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
    bio: 'Уверовал в Леад',
  },
  {
    id: 'n-jadu',
    kind: 'character',
    name: 'Джаду',
    race: 'Табакси',
    classes: 'Волшебник',
    x: 28,
    y: 20,
    bio: 'Считает, что хорошие дела должны хорошо оплачиваться',
  },
  {
    id: 'n-metel',
    kind: 'character',
    name: 'Метель',
    race: 'Тифлинг',
    classes: 'Плут',
    x: 60,
    y: 40,
    bio: 'Ты бы не выжил при её дворе',
  },
  {
    id: 'n-ogen',
    kind: 'character',
    name: 'Оген',
    race: 'Дженази',
    classes: 'Плут · Чародей',
    x: 84,
    y: 46,
    bio: 'Не любит распространяться о своём прошлом',
  },
];

/* Девять сущностей Алекса. Статусы — догадки, поправь.
 * Типы тоже догадки, кроме Стоунфеллоу: он NPC, подтверждено. */
const ENTITIES: NodeSeed[] = [
  {
    id: 'n-tavern',
    kind: 'location',
    name: 'Та Самая Таверна',
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
  { id: 'n-academy', kind: 'location', name: 'Магическая Академия', x: 88, y: 12 },
  { id: 'n-vodorosl', kind: 'npc', name: 'Водоросль', x: 52, y: 58 },
  { id: 'n-sands', kind: 'location', name: 'Пески Пустыни', x: 8, y: 88 },
];

/* Ручные связи. Ярлыки — заглушки. */
/* Граф собран с нуля: прежние связи и упоминания убраны, здесь только то,
 * что назвал Алекс. Пустой ярлык — тип связи не задан. */
const MANUAL_LINKS: [from: string, to: string, label: string][] = [
  ['n-academy', 'n-stonefellow', 'Завсегдатай'],
  ['n-aelis', 'n-father', 'Родство'],
  ['n-stonefellow', 'n-pearl', ''],
  ['n-vodorosl', 'n-tavern', 'Завсегдатай'],
];

/* Цитатник — настоящий, со слов Алекса. Сессии он не называл, поэтому
 * цитаты не привязаны ни к одной: в карточке просто не будет метки «С14».
 * Диалог хранится одной цитатой в две строки — реплика без подводки теряет
 * смысл; автором считается тот, кто начал. */
type QuoteSeed = { id: string; author: string; subject: string; lines: string[] };

const QUOTES: QuoteSeed[] = [
  {
    id: 'q-dvor-metel',
    author: 'u-metel',
    subject: 'n-metel',
    lines: ['Ты бы не выжил при моём дворе!'],
  },
  {
    id: 'q-aziz',
    author: 'u-aelis',
    subject: 'n-aelis',
    lines: [
      'Предсказатель Азиз говорил, что мы потеряем наши деньги и мы их действительно потеряли, потому что сообщник Азиза обчистил наши карманы! Получается, сбылось предсказание! Азиз как бы и не обманул, а ощущение обмана всё равно осталось!',
    ],
  },
  {
    id: 'q-said',
    author: 'u-ogen',
    subject: 'n-ogen',
    lines: [
      'Оген: Саид нам расскажет, что он хочет. Мы ему расскажем, что мы хотим взамен того, что он хочет. Потом мы будем долго спорить кто из нас чего больше хочет. Потом мы договоримся… или нет',
      'Аэлис: Ты тоже пророк, почти как Азиз!',
    ],
  },
  {
    id: 'q-nyt',
    author: 'u-ogen',
    subject: 'n-ogen',
    lines: ['А ты умеешь, что-нибудь, кроме того, чтобы ныть?'],
  },
  {
    id: 'q-butylka',
    author: 'u-ogen',
    subject: 'n-ogen',
    lines: [
      'Оген (про артефакт): С этой бутылкой есть проблема — она просит её открыть',
      'Аэлис: Знаешь, я иногда сижу в баре и бутылка тоже как будто просит себя открыть…',
    ],
  },
  {
    id: 'q-arbalet',
    author: 'u-ogen',
    subject: 'n-ogen',
    lines: ['Я делаю странное: достаю арбалет и стреляю из лука'],
  },
  {
    id: 'q-dvor-ogen',
    author: 'u-ogen',
    subject: 'n-ogen',
    lines: ['Ты бы не выжила при своём дворе!'],
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
    nextGame: '16 сентября (среда), старт в 20.00',
  });

  const sessionRows = Array.from({ length: SESSION_COUNT }, (_, i) => {
    const number = i + 1;
    return {
      id: `s-${number}`,
      campaignId: CAMPAIGN_ID,
      number,
      date: null,
      title: SESSION_TITLES[number] ?? null,
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
    QUOTES.map((quote) => ({
      id: quote.id,
      campaignId: CAMPAIGN_ID,
      sessionId: null,
      kind: 'quote' as const,
      title: null,
      body: quote.lines.join('\n'),
      authorId: quote.author,
      subjectId: quote.subject,
      tags: [],
      visibility: 'public' as const,
      createdAt: SEEDED_AT,
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
      /* Пустой ярлык хранится как отсутствие значения, а не пустой строкой. */
      label: label.trim() || null,
    })),
  );

  /* Рёбра-упоминания сид не заводит: записей, из которых их считать, здесь
   * больше нет. Настоящие появятся при первом сохранении записи — их
   * пересчитывает lib/wiki/sync-links. */
}

export { CAMPAIGN_ID, SESSION_COUNT, SESSION_TITLES };
