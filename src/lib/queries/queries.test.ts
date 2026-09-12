import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/db/test-db';
import { runDb, setDbForTesting } from '@/lib/db/client';
import { FIXTURE, seedFixture } from '@/lib/db/fixture';
import type { Viewer } from '@/lib/auth-shared';
import * as t from '@/lib/db/schema';
import { getBoard } from './board';
import { getCharacter } from './characters';
import { getFeed, getRecentSessions, getStatusNodes } from './chronicle';
import { getGallery } from './gallery';
import { getFreeNotes, getNodeCards, getRumors, kbCards } from './kb';
import { getQuotes, getRandomQuote } from './quotes';
import { findSessionId, getSessionOptions, resolveSessionId } from './sessions';

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

describe('База знаний: состав табов', () => {
  /* Регрессия: список собирался из белого списка «наводки + NPC + локации»,
   * и узел другого типа без статуса не попадал ни в один таб — хотя кнопка
   * «+ Добавить» на этой же странице заводит все восемь типов. */
  it('во «Всё» попадает узел без статуса и вне NPC и локаций', async () => {
    const [rumors, nodes] = await Promise.all([getRumors(), getNodeCards()]);
    expect(kbCards('all', rumors, nodes).map((card) => card.name)).toContain('Герой');
  });

  it('во «Всё» попадает свежезаведённый узел любого типа', async () => {
    await runDb((db) =>
      db.insert(t.nodes).values({
        id: 'n-guild',
        campaignId: FIXTURE.campaignId,
        kind: 'faction',
        name: 'Гильдия',
        slug: 'gildiya',
        aliases: [],
      }),
    );

    const [rumors, nodes] = await Promise.all([getRumors(), getNodeCards()]);
    expect(kbCards('all', rumors, nodes).map((card) => card.name)).toContain('Гильдия');
  });

  it('во «Всё» наводки идут первыми, остальные по имени', async () => {
    const [rumors, nodes] = await Promise.all([getRumors(), getNodeCards()]);
    expect(kbCards('all', rumors, nodes).map((card) => card.name)).toEqual([
      'Таверна',
      'Призрак',
      'Тупик',
      'Герой',
    ]);
  });

  it('узел со статусом не задваивается', async () => {
    const [rumors, nodes] = await Promise.all([getRumors(), getNodeCards()]);
    const names = kbCards('all', rumors, nodes).map((card) => card.name);
    expect(names.filter((name) => name === 'Таверна')).toHaveLength(1);
  });

  it('подтабы остаются фильтром по типу', async () => {
    const nodes = await getNodeCards();
    expect(kbCards('npc', [], nodes).map((card) => card.name)).toEqual(['Призрак']);
    expect(kbCards('locations', [], nodes).map((card) => card.name)).toEqual(['Таверна']);
  });

  it('таб «Заметки» показывает только наводки', async () => {
    const [rumors, nodes] = await Promise.all([getRumors(), getNodeCards()]);
    expect(kbCards('notes', rumors, nodes).map((card) => card.name)).not.toContain('Герой');
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
  it('в цитатнике все цитаты равноценны — ни одна не вынесена наверх', async () => {
    const data = await getQuotes(null, null);
    expect(data.total).toBe(2);
    expect(data.quotes).toHaveLength(2);
  });

  it('отмечает голос текущего пользователя', async () => {
    const mine = await getQuotes(null, player);
    expect(mine.quotes.find((quote) => quote.body === 'Свежая цитата.')?.myVote).toBe(true);

    const theirs = await getQuotes(null, other);
    expect(theirs.quotes.find((quote) => quote.body === 'Свежая цитата.')?.myVote).toBe(false);
  });

  it('фильтр по автору отбирает по слагу персонажа', async () => {
    /* Обе цитаты фикстуры принадлежат Герою, поэтому фильтр их не сужает,
     * а вот несуществующий автор не даёт ничего. */
    expect((await getQuotes('geroy', null)).quotes).toHaveLength(2);
    expect((await getQuotes('nikto', null)).quotes).toHaveLength(0);
  });
});

describe('getRandomQuote', () => {
  it('со временем показывает разные цитаты', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      seen.add((await getRandomQuote(null))?.id ?? '');
    }
    expect(seen.size).toBe(2);
  });

  it('отдаёт голос текущего пользователя', async () => {
    for (let i = 0; i < 10; i += 1) {
      const quote = await getRandomQuote(player);
      if (quote?.body === 'Свежая цитата.') {
        expect(quote.myVote).toBe(true);
        return;
      }
    }
    throw new Error('свежая цитата ни разу не выпала за десять попыток');
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

describe('getGallery', () => {
  /* Заголовок группы ведёт на страницу сессии — номер для ссылки берут
   * из самой группы, а не выковыривают из её названия. */
  it('группа сессии знает свой номер', async () => {
    const gallery = await getGallery('all', true);
    expect(gallery.groups.map((group) => [group.title, group.sessionNumber])).toEqual([
      ['Сессия 2', 2],
      ['Сессия 1 — Первая', 1],
    ]);
  });

  it('у группы «Без сессии» номера нет — вести некуда', async () => {
    await runDb(async (db) => {
      await db.insert(t.images).values({
        id: 'i-loose',
        campaignId: FIXTURE.campaignId,
        url: null,
        caption: 'Карта мира',
        uploaderId: FIXTURE.users.player,
        kind: 'map',
      });
    });

    const gallery = await getGallery('all', true);
    const loose = gallery.groups.find((group) => group.title === 'Без сессии');
    expect(loose?.sessionNumber).toBeNull();
  });

  it('плоский список номера не несёт — в нём кадры всех игр разом', async () => {
    const gallery = await getGallery('all', false);
    expect(gallery.groups[0].sessionNumber).toBeNull();
  });
});

describe('достижения персонажа', () => {
  it('приходят с подписью и автором загрузки', async () => {
    const character = await getCharacter('geroy', null);
    expect(character?.achievements).toHaveLength(1);
    expect(character?.achievements[0]).toMatchObject({
      caption: 'Первый уровень',
      url: '/uploads/achievement.png',
      uploaderId: FIXTURE.users.player,
      uploaderName: 'Игрок',
    });
  });

  it('в сетку сайдбара не попадают — она про кадры кампании', async () => {
    const character = await getCharacter('geroy', null);
    expect(character?.images.map((image) => image.caption)).toEqual(['Кадр']);
  });

  it('в общую «Галерею» не попадают ни в одном фильтре', async () => {
    const all = await getGallery('all', false);
    expect(all.total).toBe(2);
    expect(all.groups[0].images.map((image) => image.caption)).not.toContain('Первый уровень');
  });

  it('чужого персонажа с собой не приносят', async () => {
    await runDb(async (db) => {
      await db.insert(t.characters).values({ nodeId: FIXTURE.nodes.ghost, isPc: false });
      await db.insert(t.images).values({
        id: 'i-achievement-ghost',
        campaignId: FIXTURE.campaignId,
        nodeId: FIXTURE.nodes.ghost,
        url: '/uploads/ghost.png',
        caption: 'Чужое',
        uploaderId: FIXTURE.users.other,
        kind: 'achievement',
      });
    });

    const character = await getCharacter('geroy', null);
    expect(character?.achievements.map((item) => item.caption)).toEqual(['Первый уровень']);
  });
});

describe('getRecentSessions', () => {
  it('последние сверху', async () => {
    expect((await getRecentSessions(5)).map((session) => session.number)).toEqual([2, 1]);
  });
});

describe('getSessionOptions и resolveSessionId', () => {
  it('выпадающий список идёт от последней сессии — она стоит по умолчанию', async () => {
    expect((await getSessionOptions()).map((session) => session.number)).toEqual([2, 1]);
  });

  it('берёт сессию, выбранную в шите', async () => {
    expect(await runDb((db) => resolveSessionId(db, 's-1'))).toBe('s-1');
  });

  it('без выбора и на неизвестный id ставит активную', async () => {
    expect(await runDb((db) => resolveSessionId(db))).toBe('s-2');
    expect(await runDb((db) => resolveSessionId(db, 'нет-такой'))).toBe('s-2');
  });

  it('сессию чужой кампании не берёт', async () => {
    await runDb(async (db) => {
      await db.insert(t.campaigns).values({ id: 'c-2', title: 'Чужая' });
      await db.insert(t.sessions).values({ id: 's-чужая', campaignId: 'c-2', number: 9 });
    });
    expect(await runDb((db) => resolveSessionId(db, 's-чужая'))).toBe('s-2');
    /* На правке пустой ответ означает «сессию не менять», поэтому важно,
     * что чужой id даёт именно null, а не подстановку активной. */
    expect(await runDb((db) => findSessionId(db, 's-чужая'))).toBeNull();
  });

  it('без выбора сессии правка её не меняет', async () => {
    expect(await runDb((db) => findSessionId(db, null))).toBeNull();
  });
});
