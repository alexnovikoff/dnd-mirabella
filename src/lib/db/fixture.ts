/* Небольшая кампания для тестов слоя запросов: пятеро в базе не нужны,
 * нужен предсказуемый набор записей, узлов и рёбер. */

import type { Db } from './client';
import * as t from './schema';
import { CAMPAIGN_ID } from './seed';

export const FIXTURE = {
  campaignId: CAMPAIGN_ID,
  users: { player: 'u-test-player', other: 'u-test-other', dm: 'u-test-dm' },
  nodes: { hero: 'n-hero', tavern: 'n-tavern', ghost: 'n-ghost', dead: 'n-dead' },
  entries: {
    moment: 'e-moment',
    crit: 'e-crit',
    fail: 'e-fail',
    loot: 'e-loot',
    quote: 'e-quote',
    quoteOld: 'e-quote-old',
    draft: 'e-draft',
    privateNote: 'e-private',
    dmOnly: 'e-dm-only',
  },
} as const;

const day = 24 * 3600 * 1000;

export async function seedFixture(db: Db) {
  const now = Date.now();
  const recent = new Date(now - day);
  const old = new Date(now - 30 * day);

  await db.insert(t.users).values([
    { id: FIXTURE.users.player, name: 'Игрок', initial: 'И', role: 'player' },
    { id: FIXTURE.users.other, name: 'Другой', initial: 'Д', role: 'player' },
    { id: FIXTURE.users.dm, name: 'Мастер', initial: 'М', role: 'dm' },
  ]);

  await db
    .insert(t.campaigns)
    .values({ id: CAMPAIGN_ID, title: 'Тестовая', seal: 'Т', eyebrow: null, tagline: null });

  await db.insert(t.sessions).values([
    { id: 's-1', campaignId: CAMPAIGN_ID, number: 1, date: '2026-01-01', title: 'Первая' },
    { id: 's-2', campaignId: CAMPAIGN_ID, number: 2, date: '2026-01-08', title: null },
  ]);

  await db.insert(t.nodes).values([
    {
      id: FIXTURE.nodes.hero,
      campaignId: CAMPAIGN_ID,
      kind: 'character',
      name: 'Герой',
      slug: 'geroy',
      aliases: [],
    },
    {
      id: FIXTURE.nodes.tavern,
      campaignId: CAMPAIGN_ID,
      kind: 'location',
      name: 'Таверна',
      slug: 'taverna',
      status: 'open',
      aliases: ['Кабак'],
    },
    {
      id: FIXTURE.nodes.ghost,
      campaignId: CAMPAIGN_ID,
      kind: 'npc',
      name: 'Призрак',
      slug: 'prizrak',
      status: 'resolved',
      aliases: [],
    },
    {
      id: FIXTURE.nodes.dead,
      campaignId: CAMPAIGN_ID,
      kind: 'rumor',
      name: 'Тупик',
      slug: 'tupik',
      status: 'dead_end',
      aliases: [],
    },
  ]);

  await db.insert(t.characters).values({
    nodeId: FIXTURE.nodes.hero,
    race: 'Человек',
    classes: 'Плут',
    isPc: true,
    playerId: FIXTURE.users.player,
  });

  await db.insert(t.boardPositions).values([
    { nodeId: FIXTURE.nodes.tavern, x: 20, y: 20 },
    { nodeId: FIXTURE.nodes.ghost, x: 60, y: 40 },
    { nodeId: FIXTURE.nodes.dead, x: 40, y: 80 },
  ]);

  await db.insert(t.entries).values([
    {
      id: FIXTURE.entries.moment,
      campaignId: CAMPAIGN_ID,
      sessionId: 's-2',
      kind: 'moment',
      title: 'Момент',
      body: 'Были в [[Таверна]] с [[Призрак]].',
      authorId: FIXTURE.users.player,
      subjectId: FIXTURE.nodes.hero,
      visibility: 'public',
      createdAt: recent,
    },
    {
      id: FIXTURE.entries.crit,
      campaignId: CAMPAIGN_ID,
      sessionId: 's-2',
      kind: 'moment',
      title: 'Крит',
      body: 'Двадцатка.',
      authorId: FIXTURE.users.player,
      subjectId: FIXTURE.nodes.hero,
      roll: 20,
      isCrit: true,
      visibility: 'public',
      createdAt: recent,
    },
    {
      id: FIXTURE.entries.fail,
      campaignId: CAMPAIGN_ID,
      sessionId: 's-1',
      kind: 'moment',
      title: 'Провал',
      body: 'Единица.',
      authorId: FIXTURE.users.other,
      isFail: true,
      visibility: 'public',
      createdAt: old,
    },
    {
      id: FIXTURE.entries.loot,
      campaignId: CAMPAIGN_ID,
      sessionId: 's-1',
      kind: 'moment',
      title: 'Лут',
      body: 'Сундук.',
      authorId: FIXTURE.users.other,
      tags: ['#лут'],
      visibility: 'public',
      createdAt: old,
    },
    {
      id: FIXTURE.entries.quote,
      campaignId: CAMPAIGN_ID,
      sessionId: 's-2',
      kind: 'quote',
      body: 'Свежая цитата.',
      authorId: FIXTURE.users.player,
      subjectId: FIXTURE.nodes.hero,
      visibility: 'public',
      createdAt: recent,
    },
    {
      id: FIXTURE.entries.quoteOld,
      campaignId: CAMPAIGN_ID,
      sessionId: 's-1',
      kind: 'quote',
      body: 'Старая цитата.',
      authorId: FIXTURE.users.other,
      subjectId: FIXTURE.nodes.hero,
      visibility: 'public',
      createdAt: old,
    },
    {
      id: FIXTURE.entries.draft,
      campaignId: CAMPAIGN_ID,
      sessionId: 's-2',
      kind: 'moment',
      title: 'Черновик',
      body: 'Не готово.',
      authorId: FIXTURE.users.player,
      visibility: 'draft',
      createdAt: recent,
    },
    {
      id: FIXTURE.entries.privateNote,
      campaignId: CAMPAIGN_ID,
      sessionId: 's-2',
      kind: 'note',
      body: 'Личное.',
      authorId: FIXTURE.users.player,
      visibility: 'private',
      createdAt: recent,
    },
    {
      id: FIXTURE.entries.dmOnly,
      campaignId: CAMPAIGN_ID,
      sessionId: 's-2',
      kind: 'moment',
      title: 'Секрет мастера',
      body: 'Тайна.',
      authorId: FIXTURE.users.dm,
      visibility: 'dm_only',
      createdAt: recent,
    },
  ]);

  /* Голоса: у старой цитаты их больше, но цитата недели считается только
   * среди свежих — это и проверяем. */
  await db.insert(t.votes).values([
    { entryId: FIXTURE.entries.quote, userId: FIXTURE.users.player },
    { entryId: FIXTURE.entries.quoteOld, userId: FIXTURE.users.player },
    { entryId: FIXTURE.entries.quoteOld, userId: FIXTURE.users.other },
    { entryId: FIXTURE.entries.quoteOld, userId: FIXTURE.users.dm },
  ]);

  await db.insert(t.links).values([
    {
      id: 'l-manual',
      campaignId: CAMPAIGN_ID,
      kind: 'manual',
      fromNodeId: FIXTURE.nodes.tavern,
      toNodeId: FIXTURE.nodes.ghost,
      label: 'Слух',
    },
    {
      id: 'l-m1',
      campaignId: CAMPAIGN_ID,
      kind: 'mention',
      fromEntryId: FIXTURE.entries.moment,
      toNodeId: FIXTURE.nodes.tavern,
    },
    {
      id: 'l-m2',
      campaignId: CAMPAIGN_ID,
      kind: 'mention',
      fromEntryId: FIXTURE.entries.moment,
      toNodeId: FIXTURE.nodes.ghost,
    },
  ]);

  await db.insert(t.images).values([
    {
      id: 'i-1',
      campaignId: CAMPAIGN_ID,
      sessionId: 's-2',
      entryId: FIXTURE.entries.moment,
      url: null,
      caption: 'Кадр',
      uploaderId: FIXTURE.users.player,
      kind: 'art',
      isKey: true,
      createdAt: recent,
    },
    {
      id: 'i-2',
      campaignId: CAMPAIGN_ID,
      sessionId: 's-1',
      url: null,
      caption: 'Карта',
      uploaderId: FIXTURE.users.other,
      kind: 'map',
      createdAt: old,
    },
  ]);
}
