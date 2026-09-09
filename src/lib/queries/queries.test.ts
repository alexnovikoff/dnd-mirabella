import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/db/test-db';
import { setDbForTesting } from '@/lib/db/client';
import { FIXTURE, seedFixture } from '@/lib/db/fixture';
import type { Viewer } from '@/lib/auth-shared';
import * as t from '@/lib/db/schema';
import { getBoard } from './board';
import { getFeed, getRecentSessions, getStatusNodes } from './chronicle';
import { getFreeNotes, getRumors } from './kb';
import { getQuotes } from './quotes';

const player: Viewer = {
  id: FIXTURE.users.player,
  name: 'Игрок',
  initial: 'И',
  role: 'player',
  characterSlug: 'geroy',
};
const other: Viewer = { ...player, id: FIXTURE.users.other, name: 'Другой' };
const dm: Viewer = { ...player, id: FIXTURE.users.dm, name: 'Мастер', role: 'dm' };

beforeEach(async () => {
  const db = await createTestDb();
  await seedFixture(db);
  setDbForTesting(db);
});

afterEach(() => setDbForTesting(null));

const titles = (rows: { title: string | null; body: string | null }[]) =>
  rows.map((row) => row.title ?? row.body);

describe('getFeed', () => {
  it('гостю показывает только опубликованное', async () => {
    const feed = await getFeed('all', null);
    expect(titles(feed).sort()).toEqual([
      'Крит',
      'Лут',
      'Момент',
      'Провал',
      'Свежая цитата.',
      'Старая цитата.',
    ]);
  });

  it('автору добавляет его черновик, но не чужой скрытый', async () => {
    const feed = await getFeed('all', player);
    expect(titles(feed)).toContain('Черновик');
    expect(titles(feed)).not.toContain('Секрет мастера');
  });

  it('другому игроку чужой черновик не показывает', async () => {
    const feed = await getFeed('all', other);
    expect(titles(feed)).not.toContain('Черновик');
  });

  it('мастеру показывает всё, включая скрытое от игроков', async () => {
    const feed = await getFeed('all', dm);
    expect(titles(feed)).toContain('Секрет мастера');
    expect(titles(feed)).toContain('Черновик');
  });

  it('фильтр «цитаты» оставляет только цитаты', async () => {
    const feed = await getFeed('quotes', null);
    expect(feed.every((entry) => entry.kind === 'quote')).toBe(true);
  });

  it('фильтр «провалы» смотрит на флаг, а не на текст', async () => {
    expect(titles(await getFeed('fails', null))).toEqual(['Провал']);
  });

  it('фильтр «лут» смотрит на тег', async () => {
    expect(titles(await getFeed('loot', null))).toEqual(['Лут']);
  });

  it('свежие записи идут первыми', async () => {
    const feed = await getFeed('all', null);
    expect(feed[0].sessionNumber).toBe(2);
  });

  it('подтягивает изображение и голоса записи', async () => {
    const feed = await getFeed('all', null);
    const moment = feed.find((entry) => entry.title === 'Момент');
    expect(moment?.image?.caption).toBe('Кадр');
    expect(feed.find((entry) => entry.body === 'Старая цитата.')?.votes).toBe(3);
  });
});

describe('getStatusNodes и getRumors', () => {
  /* Регрессия: коррелированный подзапрос отдавал ноль на всех узлах. */
  it('считают входящие связи, а не ноль', async () => {
    const rows = await getStatusNodes(10);
    const byName = Object.fromEntries(rows.map((row) => [row.name, row.links]));
    expect(byName['Таверна']).toBe(1);
    expect(byName['Призрак']).toBe(2);
    expect(byName['Тупик']).toBe(0);
  });

  it('наводки отдают соседей по ручным рёбрам', async () => {
    const rumors = await getRumors();
    const tavern = rumors.find((row) => row.name === 'Таверна');
    expect(tavern?.related.map((node) => node.name)).toEqual(['Призрак']);
  });

  it('узлы без статуса в наводки не попадают', async () => {
    expect((await getRumors()).map((row) => row.name)).not.toContain('Герой');
  });
});

describe('getFreeNotes', () => {
  it('гость личную заметку не видит', async () => {
    expect(await getFreeNotes(null)).toHaveLength(0);
  });

  it('автор видит свою личную заметку', async () => {
    const notes = await getFreeNotes(player);
    expect(notes).toHaveLength(1);
    expect(notes[0].isPrivate).toBe(true);
  });

  it('другой игрок чужую личную заметку не видит', async () => {
    expect(await getFreeNotes(other)).toHaveLength(0);
  });

  it('мастер видит чужие личные заметки', async () => {
    expect(await getFreeNotes(dm)).toHaveLength(1);
  });
});

describe('getQuotes', () => {
  it('цитата недели — свежая, даже если у старой голосов больше', async () => {
    const data = await getQuotes(null, null);
    expect(data.ofWeek?.body).toBe('Свежая цитата.');
    expect(data.quotes.map((quote) => quote.body)).toEqual(['Старая цитата.']);
  });

  it('отмечает голос текущего пользователя', async () => {
    const data = await getQuotes(null, player);
    expect(data.ofWeek?.myVote).toBe(true);
    expect((await getQuotes(null, other)).ofWeek?.myVote).toBe(false);
  });

  it('фильтр по автору отбирает по слагу персонажа', async () => {
    expect((await getQuotes('geroy', null)).quotes).toHaveLength(1);
    expect((await getQuotes('nikto', null)).quotes).toHaveLength(0);
  });
});

describe('getBoard', () => {
  it('отдаёт только узлы с координатами', async () => {
    const board = await getBoard();
    expect(board.nodes.map((node) => node.name).sort()).toEqual(['Призрак', 'Таверна', 'Тупик']);
  });

  it('ручное ребро приходит с ярлыком', async () => {
    const manual = (await getBoard()).edges.find((edge) => edge.kind === 'manual');
    expect(manual?.label).toBe('Слух');
  });

  it('не дублирует выведенным ребром то, что уже связано руками', async () => {
    /* Таверна и Призрак названы в одном моменте И связаны вручную —
     * линия должна остаться одна. */
    const edges = (await getBoard()).edges;
    const between = edges.filter(
      (edge) =>
        [edge.from, edge.to].sort().join() ===
        [FIXTURE.nodes.tavern, FIXTURE.nodes.ghost].sort().join(),
    );
    expect(between).toHaveLength(1);
    expect(between[0].kind).toBe('manual');
  });

  it('выводит ребро из совместного упоминания', async () => {
    const db = await createTestDb();
    await seedFixture(db);
    /* Третий узел в том же моменте — с ним ручной связи нет. */
    await db.insert(t.links).values({
      id: 'l-m3',
      campaignId: FIXTURE.campaignId,
      kind: 'mention',
      fromEntryId: FIXTURE.entries.moment,
      toNodeId: FIXTURE.nodes.dead,
    });
    setDbForTesting(db);

    const derived = (await getBoard()).edges.filter((edge) => edge.kind === 'mention');
    expect(derived).toHaveLength(2);
    expect(derived.every((edge) => edge.label === null)).toBe(true);
  });

  it('не выводит ребро на узел без координат', async () => {
    const db = await createTestDb();
    await seedFixture(db);
    await db.insert(t.links).values({
      id: 'l-m4',
      campaignId: FIXTURE.campaignId,
      kind: 'mention',
      fromEntryId: FIXTURE.entries.moment,
      toNodeId: FIXTURE.nodes.hero,
    });
    setDbForTesting(db);

    const edges = (await getBoard()).edges;
    expect(
      edges.some((edge) => edge.from === FIXTURE.nodes.hero || edge.to === FIXTURE.nodes.hero),
    ).toBe(false);
  });
});

describe('getRecentSessions', () => {
  it('последние сверху', async () => {
    expect((await getRecentSessions(5)).map((session) => session.number)).toEqual([2, 1]);
  });
});
