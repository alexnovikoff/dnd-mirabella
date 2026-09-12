/* Упоминания из описания сессии.
 *
 * README: «Каждая [[ссылка]] создаёт ребро графа с типом mention». Описание
 * сессии — такой же текст со ссылками, как момент или заметка, и рёбра должны
 * появляться и исчезать вместе с ним.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { runDb, setDbForTesting } from '@/lib/db/client';
import { createTestDb } from '@/lib/db/test-db';
import { FIXTURE, seedFixture } from '@/lib/db/fixture';
import * as t from '@/lib/db/schema';

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

const viewer = vi.hoisted(() => ({
  current: {
    id: 'u-test-player',
    name: 'Игрок',
    initial: 'И',
    role: 'player',
    characterSlug: 'geroy',
  } as unknown,
}));

vi.mock('@/lib/viewer', () => ({ getViewer: async () => viewer.current }));

const { deleteSession, deleteSessionDescription, resolveSessionMention, saveSessionDescription } =
  await import('./sessions');
const { getBoard, getNodeDetail } = await import('@/lib/queries/board');

beforeEach(async () => {
  const db = await createTestDb();
  await seedFixture(db);
  setDbForTesting(db);
  viewer.current = {
    id: FIXTURE.users.player,
    name: 'Игрок',
    initial: 'И',
    role: 'player',
    characterSlug: 'geroy',
  };
});

afterEach(() => setDbForTesting(null));

/** Все рёбра-упоминания, ведущие в узел, — с источником каждого. */
const mentionsOf = (nodeId: string) =>
  runDb((db) =>
    db
      .select({ entryId: t.links.fromEntryId, sessionId: t.links.fromSessionId })
      .from(t.links)
      .where(and(eq(t.links.kind, 'mention'), eq(t.links.toNodeId, nodeId))),
  );

/** Только те, что пришли из пересказов игр. В фикстуре у «Таверны» уже есть
 *  ребро от записи — его эти тесты касаться не должны. */
const fromSessions = async (nodeId: string) =>
  (await mentionsOf(nodeId)).filter((row) => row.sessionId !== null);

describe('описание сессии заводит рёбра-упоминания', () => {
  it('создаёт ребро на каждую ссылку из описания', async () => {
    await saveSessionDescription(1, 'Вечер начался в [[Таверна]].');

    expect(await fromSessions(FIXTURE.nodes.tavern)).toEqual([{ entryId: null, sessionId: 's-1' }]);
  });

  it('резолвит алиас узла', async () => {
    await saveSessionDescription(1, 'Сидели в [[Кабак]] до утра.');

    expect(await fromSessions(FIXTURE.nodes.tavern)).toHaveLength(1);
  });

  it('убранная из текста ссылка уносит ребро', async () => {
    await saveSessionDescription(1, '[[Таверна]] и [[Призрак]].');
    await saveSessionDescription(1, 'Только [[Таверна]].');

    expect(await fromSessions(FIXTURE.nodes.ghost)).toHaveLength(0);
    expect(await fromSessions(FIXTURE.nodes.tavern)).toHaveLength(1);
  });

  it('удаление описания снимает рёбра', async () => {
    await saveSessionDescription(1, 'Вечер в [[Таверна]].');
    await deleteSessionDescription(1);

    expect(await fromSessions(FIXTURE.nodes.tavern)).toHaveLength(0);
  });

  it('возвращает имена, которым не нашлось сущности', async () => {
    const result = await saveSessionDescription(1, 'Встретили [[Безымянный]] у [[Таверна]].');

    expect(result).toMatchObject({ ok: true, unresolved: ['Безымянный'] });
  });

  it('рёбра уходят вместе с удалённой сессией', async () => {
    await saveSessionDescription(1, 'Вечер в [[Таверна]].');
    await deleteSession(1);

    expect(await fromSessions(FIXTURE.nodes.tavern)).toHaveLength(0);
  });

  it('не трогает рёбра записей', async () => {
    await saveSessionDescription(1, 'Вечер в [[Таверна]].');
    await deleteSessionDescription(1);

    const rows = await mentionsOf(FIXTURE.nodes.tavern);
    expect(rows).toEqual([{ entryId: FIXTURE.entries.moment, sessionId: null }]);
  });
});

describe('«создать» для имени без сущности', () => {
  it('заводит узел и тут же вешает на него ребро', async () => {
    await saveSessionDescription(1, 'Встретили [[Безымянный]].');

    const result = await resolveSessionMention(1, 'Безымянный');
    expect(result).toEqual({ ok: true, number: 1, unresolved: [] });

    const detail = await getNodeDetail('bezymyannyy');
    expect(detail?.kind).toBe('unknown');
    expect(detail?.mentions.sessions).toEqual([{ number: 1, title: 'Первая' }]);
  });

  it('на пустое имя отвечает ошибкой', async () => {
    expect(await resolveSessionMention(1, '  ')).toEqual({
      ok: false,
      error: 'Пустое имя сущности',
    });
  });
});

describe('панель узла показывает упоминания из сессий', () => {
  it('называет сессию, в описании которой узел упомянут', async () => {
    await saveSessionDescription(1, 'Вечер в [[Таверна]].');

    const detail = await getNodeDetail('taverna');
    expect(detail?.mentions.sessions).toEqual([{ number: 1, title: 'Первая' }]);
  });

  it('без упоминаний список сессий пуст', async () => {
    const detail = await getNodeDetail('taverna');
    expect(detail?.mentions.sessions).toEqual([]);
  });
});

describe('доска связей', () => {
  /** Есть ли выведенное ребро между парой узлов — в любую сторону. */
  const hasMention = (edges: { from: string; to: string; kind: string }[], a: string, b: string) =>
    edges.some(
      (edge) =>
        edge.kind === 'mention' &&
        ((edge.from === a && edge.to === b) || (edge.from === b && edge.to === a)),
    );

  it('связывает узлы, названные в одном пересказе', async () => {
    expect(hasMention((await getBoard()).edges, FIXTURE.nodes.tavern, FIXTURE.nodes.dead)).toBe(
      false,
    );

    await saveSessionDescription(1, 'Из [[Таверна]] дорога вела в [[Тупик]].');

    expect(hasMention((await getBoard()).edges, FIXTURE.nodes.tavern, FIXTURE.nodes.dead)).toBe(
      true,
    );
  });

  it('правка пересказа убирает выведенное ребро', async () => {
    await saveSessionDescription(1, '[[Таверна]] и [[Тупик]].');
    await saveSessionDescription(1, 'Только [[Таверна]].');

    expect(hasMention((await getBoard()).edges, FIXTURE.nodes.tavern, FIXTURE.nodes.dead)).toBe(
      false,
    );
  });
});
