/* Размер плитки на доске: ширина и высота хранятся рядом с координатами,
 * общие на кампанию, держатся в пределах и пишутся вместе с новым центром.
 * Вход подменён.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setDbForTesting } from '@/lib/db/client';
import { createTestDb } from '@/lib/db/test-db';
import { FIXTURE, seedFixture } from '@/lib/db/fixture';

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

const player = {
  id: FIXTURE.users.player,
  name: 'Игрок',
  initial: 'И',
  role: 'player',
  characterSlug: 'geroy',
};

const viewer = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('@/lib/viewer', () => ({ getViewer: async () => viewer.current }));

const { createBoardNode, saveNodeBox, saveNodePosition } = await import('./board');
const { getBoard } = await import('@/lib/queries/board');

const TAVERN = FIXTURE.nodes.tavern;

async function tavern() {
  const board = await getBoard();
  return board.nodes.find((node) => node.id === TAVERN);
}

beforeEach(async () => {
  const db = await createTestDb();
  await seedFixture(db);
  setDbForTesting(db);
  viewer.current = player;
});

afterEach(() => setDbForTesting(null));

describe('saveNodeBox', () => {
  it('у узла без правки размер по умолчанию', async () => {
    expect(await tavern()).toMatchObject({ width: null, height: null });
  });

  it('сохраняет ширину, высоту и сдвинутый центр вместе', async () => {
    await saveNodeBox(TAVERN, { x: 24.67, y: 23.33, width: 280, height: 120 });
    expect(await tavern()).toMatchObject({ x: 24.67, y: 23.33, width: 280, height: 120 });
  });

  it('перенос узла не сбрасывает размер', async () => {
    await saveNodeBox(TAVERN, { x: 20, y: 20, width: 200, height: 90 });
    await saveNodePosition(TAVERN, 70.5, 30.25);
    expect(await tavern()).toMatchObject({ x: 70.5, y: 30.25, width: 200, height: 90 });
  });

  it('держит размер и центр в пределах поля', async () => {
    await saveNodeBox(TAVERN, { x: -100, y: 500, width: 5, height: 9000 });
    expect(await tavern()).toMatchObject({ x: -37, y: 163.67, width: 40, height: 600 });
  });

  it('узел переносится за полотно, на поле вокруг', async () => {
    await saveNodePosition(TAVERN, -20.5, 140.25);
    expect(await tavern()).toMatchObject({ x: -20.5, y: 140.25 });
  });

  it('новый узел появляется размера по умолчанию', async () => {
    await createBoardNode('Кузница', 'location');
    const board = await getBoard();
    expect(board.nodes.find((node) => node.name === 'Кузница')).toMatchObject({
      width: null,
      height: null,
    });
  });

  it('разлогиненному не даёт менять', async () => {
    viewer.current = null;
    await expect(saveNodeBox(TAVERN, { x: 30, y: 30, width: 300, height: 100 })).rejects.toThrow();
    expect(await tavern()).toMatchObject({ x: 20, y: 20, width: null });
  });
});
