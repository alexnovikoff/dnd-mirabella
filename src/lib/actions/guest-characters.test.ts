/* Персонаж — один тип. Узел «Персонаж» всегда со строкой в characters:
 * заведённый с доски или сменой типа он становится гостевым, тумблер
 * переводит его в основные и обратно, а тип и удаление закрыты только
 * персонажу, к которому привязан игрок. Хранилище и вход подменены.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { runDb, setDbForTesting } from '@/lib/db/client';
import { createTestDb } from '@/lib/db/test-db';
import { FIXTURE, seedFixture } from '@/lib/db/fixture';
import * as t from '@/lib/db/schema';

const fake = vi.hoisted(() => ({ removed: [] as string[] }));

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

vi.mock('@/lib/storage', () => ({
  isSupportedImage: () => true,
  saveUpload: async () => '/uploads/new.png',
  removeUpload: async (url: string | null) => {
    if (url) fake.removed.push(url);
  },
}));

vi.mock('@/lib/viewer', () => ({
  getViewer: async () => ({
    id: FIXTURE.users.player,
    name: 'Игрок',
    initial: 'И',
    role: 'player',
    characterSlug: 'geroy',
  }),
}));

const { createBoardNode } = await import('./board');
const { deleteNode, updateNode } = await import('./nodes');
const { setCharacterGuest } = await import('./characters');
const { getNodeDetail } = await import('@/lib/queries/board');
const { getCharacter, getCharacters } = await import('@/lib/queries/characters');
const { getParty } = await import('@/lib/queries/chronicle');
const { getQuoteAuthors } = await import('@/lib/queries/quotes');

const HERO = FIXTURE.nodes.hero;
const GHOST = FIXTURE.nodes.ghost;

function characterRow(nodeId: string) {
  return runDb(async (db) => {
    const [row] = await db
      .select({ isPc: t.characters.isPc, playerId: t.characters.playerId })
      .from(t.characters)
      .where(eq(t.characters.nodeId, nodeId))
      .limit(1);
    return row;
  });
}

const names = (rows: { name: string }[]) => rows.map((row) => row.name);

/** Призрак из фикстуры, переведённый в персонажи, — с портретом, кадром
 *  и достижением, чтобы было что терять при обратной смене типа. */
async function ghostAsGuest() {
  await updateNode(GHOST, { name: 'Призрак', kind: 'character', status: null, description: '' });
  await runDb(async (db) => {
    await db
      .update(t.characters)
      .set({ portrait: '/uploads/ghost.png', portraitCropUrl: '/uploads/ghost-crop.png' })
      .where(eq(t.characters.nodeId, GHOST));
    await db.insert(t.images).values({
      id: 'i-ghost-achievement',
      campaignId: FIXTURE.campaignId,
      nodeId: GHOST,
      url: '/uploads/ghost-achievement.png',
      kind: 'achievement',
    });
  });
}

beforeEach(async () => {
  fake.removed = [];
  const db = await createTestDb();
  await seedFixture(db);
  setDbForTesting(db);
});

afterEach(() => setDbForTesting(null));

describe('узел становится персонажем', () => {
  it('с доски — гостевым, со своей страницей', async () => {
    await createBoardNode('Сальма', 'character');

    const detail = await getNodeDetail('salma');
    expect(detail).toMatchObject({ isCharacter: true, isGuest: true, hasPlayer: false });
    expect(await getCharacter('salma', null)).not.toBeNull();
  });

  it('узел другого типа с доски строки персонажа не получает', async () => {
    await createBoardNode('Колодец', 'location');
    expect(await getNodeDetail('kolodets')).toMatchObject({ isCharacter: false });
  });

  it('сменой типа — тоже гостевым', async () => {
    await updateNode(GHOST, { name: 'Призрак', kind: 'character', status: null, description: '' });

    expect(await characterRow(GHOST)).toEqual({ isPc: false, playerId: null });
    expect(await getNodeDetail('prizrak')).toMatchObject({ isCharacter: true, isGuest: true });
  });
});

describe('гостевой персонаж', () => {
  it('не виден в «Партии», hero и среди авторов цитат', async () => {
    await ghostAsGuest();

    expect(names(await getCharacters())).not.toContain('Призрак');
    expect(names(await getParty())).not.toContain('Призрак');
    expect(names(await getQuoteAuthors())).not.toContain('Призрак');
  });

  it('виден в «Партии» по кнопке «Показать гостевых» — после основных', async () => {
    await ghostAsGuest();

    expect(names(await getCharacters({ guests: true }))).toEqual(['Герой', 'Призрак']);
  });

  it('тумблер переводит его в основные и обратно', async () => {
    await ghostAsGuest();

    expect(await setCharacterGuest(GHOST, false)).toEqual({ ok: true });
    expect(names(await getCharacters())).toContain('Призрак');
    expect(names(await getParty())).toContain('Призрак');
    expect(names(await getQuoteAuthors())).toContain('Призрак');

    await setCharacterGuest(HERO, true);
    expect(names(await getCharacters())).not.toContain('Герой');
    expect((await getNodeDetail('geroy'))?.isGuest).toBe(true);
  });

  it('тумблер узлу без строки персонажа отвечает ошибкой', async () => {
    expect(await setCharacterGuest(FIXTURE.nodes.tavern, true)).toEqual({
      ok: false,
      error: 'Персонаж не найден',
    });
  });
});

describe('смена типа с «Персонажа»', () => {
  it('убирает строку, достижения и файлы портрета', async () => {
    await ghostAsGuest();

    const result = await updateNode(GHOST, {
      name: 'Призрак',
      kind: 'npc',
      status: null,
      description: '',
    });

    expect(result.ok).toBe(true);
    expect(await characterRow(GHOST)).toBeUndefined();
    expect((await getNodeDetail('prizrak'))?.kind).toBe('npc');
    const achievements = await runDb((db) =>
      db.select({ id: t.images.id }).from(t.images).where(eq(t.images.nodeId, GHOST)),
    );
    expect(achievements).toEqual([]);
    expect(fake.removed.sort()).toEqual([
      '/uploads/ghost-achievement.png',
      '/uploads/ghost-crop.png',
      '/uploads/ghost.png',
    ]);
  });

  it('персонажу игрока тип не меняет', async () => {
    await updateNode(HERO, { name: 'Герой', kind: 'npc', status: null, description: '' });

    expect((await getNodeDetail('geroy'))?.kind).toBe('character');
    expect(await characterRow(HERO)).toMatchObject({ playerId: FIXTURE.users.player });
    expect(fake.removed).toEqual([]);
  });
});

describe('удаление персонажа', () => {
  it('персонажа игрока удалить нельзя', async () => {
    expect(await deleteNode(HERO)).toEqual({
      ok: false,
      error: 'Персонажа игрока удалить нельзя',
    });
    expect(await getNodeDetail('geroy')).not.toBeNull();
  });

  it('гостевого удаляет вместе с файлами', async () => {
    await ghostAsGuest();

    expect(await deleteNode(GHOST)).toEqual({ ok: true });
    expect(await getNodeDetail('prizrak')).toBeNull();
    expect(await characterRow(GHOST)).toBeUndefined();
    expect(fake.removed.sort()).toEqual([
      '/uploads/ghost-achievement.png',
      '/uploads/ghost-crop.png',
      '/uploads/ghost.png',
    ]);
  });
});
