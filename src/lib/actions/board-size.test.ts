/* Размер плитки на доске: хранится рядом с координатами, общий на кампанию,
 * держится в пределах и не трогает позицию. Вход подменён.
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

const { createBoardNode, saveNodePosition, saveNodeSize } = await import('./board');
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

describe('saveNodeSize', () => {
  it('у узла без правки обычный размер', async () => {
    expect((await tavern())?.size).toBe(100);
  });

  it('сохраняет размер и не сдвигает узел', async () => {
    await saveNodeSize(TAVERN, 180);
    expect(await tavern()).toMatchObject({ size: 180, x: 20, y: 20 });
  });

  it('перенос узла не сбрасывает размер', async () => {
    await saveNodeSize(TAVERN, 140);
    await saveNodePosition(TAVERN, 70, 30);
    expect(await tavern()).toMatchObject({ size: 140, x: 70, y: 30 });
  });

  it('держит размер в пределах', async () => {
    await saveNodeSize(TAVERN, 5);
    expect((await tavern())?.size).toBe(50);
    await saveNodeSize(TAVERN, 900);
    expect((await tavern())?.size).toBe(300);
    await saveNodeSize(TAVERN, Number.NaN);
    expect((await tavern())?.size).toBe(100);
  });

  it('новый узел появляется обычного размера', async () => {
    await createBoardNode('Кузница', 'location');
    const board = await getBoard();
    expect(board.nodes.find((node) => node.name === 'Кузница')?.size).toBe(100);
  });

  it('разлогиненному не даёт менять', async () => {
    viewer.current = null;
    await expect(saveNodeSize(TAVERN, 200)).rejects.toThrow();
    expect((await tavern())?.size).toBe(100);
  });
});
