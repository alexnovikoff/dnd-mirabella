/* Схема из раздела Data model README.
 *
 * Одно отступление, которое README прямо разрешает: Character и Entity сведены
 * в общую таблицу `nodes` с дискриминатором `kind` («персонажи тоже участвуют
 * в графе, можно вынести в общий Node»). Ради этого ребро Link получает
 * настоящие внешние ключи вместо полиморфных id — а Link здесь ядро продукта.
 * Всё, что специфично для игрового персонажа, лежит в `characters` (1:1 к узлу).
 */

import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import type { CropRect } from '../crop';

/* ── Перечисления ────────────────────────────────────────────────── */

export const roleEnum = pgEnum('role', ['player', 'dm']);

/** Типы узлов графа. 'character' — игровой персонаж, остальные из README.
 *  'unknown' — черновая сущность, созданная прямо из редактора опцией
 *  «+ создать»: тип проставят позже. */
export const nodeKindEnum = pgEnum('node_kind', [
  'character',
  'npc',
  'faction',
  'location',
  'artifact',
  'event',
  'rumor',
  'unknown',
]);

export const nodeStatusEnum = pgEnum('node_status', ['open', 'resolved', 'dead_end']);

export const entryKindEnum = pgEnum('entry_kind', ['moment', 'quote', 'note', 'image']);

export const visibilityEnum = pgEnum('visibility', ['public', 'draft', 'private', 'dm_only']);

/** 'achievement' — плашка достижения персонажа: такой кадр привязан к узлу,
 *  живёт только в блоке «Достижения» и в общую «Галерею» не попадает. */
export const imageKindEnum = pgEnum('image_kind', ['art', 'map', 'screenshot', 'achievement']);

/** mention — ребро из текста по [[ссылке]]; manual — связь, поставленная руками. */
export const linkKindEnum = pgEnum('link_kind', ['mention', 'manual']);

/* ── Таблицы ─────────────────────────────────────────────────────── */

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** Инициал в круглом аватаре чипа аккаунта. */
  initial: text('initial').notNull(),
  role: roleEnum('role').notNull().default('player'),
  /** argon2-хеш; заполняется на этапе 9, до тех пор null. */
  passwordHash: text('password_hash'),
});

export const campaigns = pgTable('campaigns', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  /** Буква на круглой печати в шапке. */
  seal: text('seal').notNull().default('?'),
  setting: text('setting'),
  /** Надстрочник над заголовком Хроники: «Дневник партии · …». */
  eyebrow: text('eyebrow'),
  /** Лид под заголовком Хроники. */
  tagline: text('tagline'),
  /** Анонс следующей игры над лентой: «16 сентября (среда), старт в 20.00».
   *  Свободная строка, а не date: за столом договариваются словами — время,
   *  день недели, «после майских», — и календарной датой это не выражается. */
  nextGame: text('next_game'),
});

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    date: date('date'),
    title: text('title'),
    location: text('location'),
    /** Пересказ игры своими словами: пишут и правят все за столом. */
    description: text('description'),
  },
  (t) => [unique('sessions_campaign_number').on(t.campaignId, t.number)],
);

export const nodes = pgTable(
  'nodes',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    kind: nodeKindEnum('kind').notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    status: nodeStatusEnum('status'),
    /** Прежние имена: после переименования старые [[ссылки]] продолжают резолвиться. */
    aliases: text('aliases')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    /** Сессия, в которой узел впервые появился — для меты «ТУПИК · С11». */
    firstSessionId: text('first_session_id').references(() => sessions.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('nodes_campaign_slug').on(t.campaignId, t.slug),
    index('nodes_campaign_kind').on(t.campaignId, t.kind),
  ],
);

/** Детали игрового персонажа. 1:1 к узлу с kind = 'character'. */
export const characters = pgTable('characters', {
  nodeId: text('node_id')
    .primaryKey()
    .references(() => nodes.id, { onDelete: 'cascade' }),
  race: text('race'),
  classes: text('classes'),
  level: integer('level'),
  /** Портрет как его загрузили. Страница персонажа и аватары Хроники
   *  показывают именно его — кадрирование их не касается. */
  portrait: text('portrait'),
  /** Кадр для карточки в «Партии»: вырезанный из портрета отдельный файл.
   *  null — не кадрировали, карточка показывает портрет. */
  portraitCropUrl: text('portrait_crop_url'),
  /** Рамка, по которой кадр вырезан, — доли портрета (см. lib/crop).
   *  По ней диалог открывается там, где его закрыли. */
  portraitCrop: jsonb('portrait_crop').$type<CropRect>(),
  bio: text('bio'),
  isPc: boolean('is_pc').notNull().default(true),
  playerId: text('player_id').references(() => users.id, { onDelete: 'set null' }),
  /** С какой сессии играет — мета «ИГРАЕТ С СЕССИИ 1». */
  sinceSession: integer('since_session'),
});

export const entries = pgTable(
  'entries',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    kind: entryKindEnum('kind').notNull(),
    title: text('title'),
    /** Текст с [[wiki-ссылками]] как есть; рёбра materialise-ит lib/wiki (этап 4). */
    body: text('body'),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    /** О ком запись — узел-персонаж; для цитат это её автор. */
    subjectId: text('subject_id').references(() => nodes.id, { onDelete: 'set null' }),
    roll: integer('roll'),
    isCrit: boolean('is_crit').notNull().default(false),
    isFail: boolean('is_fail').notNull().default(false),
    /** Теги вида «#лут»; по ним работает фильтр ЛУТ в ленте. */
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    visibility: visibilityEnum('visibility').notNull().default('public'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('entries_campaign_created').on(t.campaignId, t.createdAt),
    index('entries_session').on(t.sessionId),
  ],
);

export const images = pgTable(
  'images',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    entryId: text('entry_id').references(() => entries.id, { onDelete: 'set null' }),
    /** Узел, которому принадлежит кадр — сейчас это достижения персонажа.
     *  Кадры кампании узла не имеют: их место задают сессия и запись.
     *  Каскад, а не set null: достижение без персонажа показать негде. */
    nodeId: text('node_id').references(() => nodes.id, { onDelete: 'cascade' }),
    /** null, пока картинка не загружена: показываем плейсхолдер со штриховкой. */
    url: text('url'),
    caption: text('caption'),
    uploaderId: text('uploader_id').references(() => users.id, { onDelete: 'set null' }),
    kind: imageKindEnum('kind').notNull().default('art'),
    /** Ключевой кадр группы — плитка span 2×2 на экране «Галерея». */
    isKey: boolean('is_key').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('images_session').on(t.sessionId), index('images_node').on(t.nodeId)],
);

/** Ребро графа. Ровно один из fromNodeId / fromEntryId заполнен:
 *  узел→узел — ручная связь, запись→узел — упоминание из [[текста]]. */
export const links = pgTable(
  'links',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    kind: linkKindEnum('kind').notNull(),
    fromNodeId: text('from_node_id').references(() => nodes.id, { onDelete: 'cascade' }),
    fromEntryId: text('from_entry_id').references(() => entries.id, { onDelete: 'cascade' }),
    toNodeId: text('to_node_id')
      .notNull()
      .references(() => nodes.id, { onDelete: 'cascade' }),
    /** Тип отношения на ручном ребре: ДОЛГ, ВРАЖДА, ПРОДАНА НА, НАПАРНИК. */
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('links_exactly_one_source', sql`(${t.fromNodeId} is null) <> (${t.fromEntryId} is null)`),
    index('links_to').on(t.toNodeId),
    index('links_from_node').on(t.fromNodeId),
    index('links_from_entry').on(t.fromEntryId),
  ],
);

/** Один голос на пользователя на цитату. */
export const votes = pgTable(
  'votes',
  {
    entryId: text('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.userId] })],
);

/** Позиция узла на доске в процентах, чтобы граф масштабировался.
 *  Доска общая на кампанию — решение зафиксировано в docs/plan.md. */
export const boardPositions = pgTable('board_positions', {
  nodeId: text('node_id')
    .primaryKey()
    .references(() => nodes.id, { onDelete: 'cascade' }),
  x: integer('x').notNull(),
  y: integer('y').notNull(),
});

/* ── Связи для реляционных запросов ──────────────────────────────── */

export const campaignRelations = relations(campaigns, ({ many }) => ({
  sessions: many(sessions),
  nodes: many(nodes),
  entries: many(entries),
}));

export const sessionRelations = relations(sessions, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [sessions.campaignId], references: [campaigns.id] }),
  entries: many(entries),
  images: many(images),
}));

export const nodeRelations = relations(nodes, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [nodes.campaignId], references: [campaigns.id] }),
  character: one(characters, { fields: [nodes.id], references: [characters.nodeId] }),
  position: one(boardPositions, { fields: [nodes.id], references: [boardPositions.nodeId] }),
  incoming: many(links, { relationName: 'linkTo' }),
}));

export const characterRelations = relations(characters, ({ one }) => ({
  node: one(nodes, { fields: [characters.nodeId], references: [nodes.id] }),
  player: one(users, { fields: [characters.playerId], references: [users.id] }),
}));

export const entryRelations = relations(entries, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [entries.campaignId], references: [campaigns.id] }),
  session: one(sessions, { fields: [entries.sessionId], references: [sessions.id] }),
  author: one(users, { fields: [entries.authorId], references: [users.id] }),
  subject: one(nodes, { fields: [entries.subjectId], references: [nodes.id] }),
  images: many(images),
  mentions: many(links, { relationName: 'linkFromEntry' }),
  votes: many(votes),
}));

export const imageRelations = relations(images, ({ one }) => ({
  session: one(sessions, { fields: [images.sessionId], references: [sessions.id] }),
  entry: one(entries, { fields: [images.entryId], references: [entries.id] }),
  node: one(nodes, { fields: [images.nodeId], references: [nodes.id] }),
  uploader: one(users, { fields: [images.uploaderId], references: [users.id] }),
}));

export const linkRelations = relations(links, ({ one }) => ({
  fromNode: one(nodes, { fields: [links.fromNodeId], references: [nodes.id] }),
  fromEntry: one(entries, {
    fields: [links.fromEntryId],
    references: [entries.id],
    relationName: 'linkFromEntry',
  }),
  toNode: one(nodes, {
    fields: [links.toNodeId],
    references: [nodes.id],
    relationName: 'linkTo',
  }),
}));

export const voteRelations = relations(votes, ({ one }) => ({
  entry: one(entries, { fields: [votes.entryId], references: [entries.id] }),
  user: one(users, { fields: [votes.userId], references: [users.id] }),
}));

/* ── Типы ────────────────────────────────────────────────────────── */

export type NodeKind = (typeof nodeKindEnum.enumValues)[number];
export type NodeStatus = (typeof nodeStatusEnum.enumValues)[number];
export type EntryKind = (typeof entryKindEnum.enumValues)[number];
export type ImageKind = (typeof imageKindEnum.enumValues)[number];
export type Visibility = (typeof visibilityEnum.enumValues)[number];
export type LinkKind = (typeof linkKindEnum.enumValues)[number];
