import { describe, expect, it } from 'vitest';
import { nodeAt, type NodeBox } from './board-drag';

function box(id: string, left: number, top: number): NodeBox {
  return { id, rect: { left, right: left + 140, top, bottom: top + 48 } };
}

describe('nodeAt', () => {
  const boxes = [box('a', 0, 0), box('b', 300, 200)];

  it('находит узел под точкой', () => {
    expect(nodeAt(boxes, 70, 24)).toBe('a');
    expect(nodeAt(boxes, 370, 224)).toBe('b');
  });

  it('молчит, когда под курсором пусто', () => {
    expect(nodeAt(boxes, 200, 100)).toBeNull();
    expect(nodeAt([], 0, 0)).toBeNull();
  });

  it('считает границу попаданием: узлы стоят плотно, промах раздражает', () => {
    expect(nodeAt(boxes, 0, 0)).toBe('a');
    expect(nodeAt(boxes, 140, 48)).toBe('a');
    expect(nodeAt(boxes, 141, 48)).toBeNull();
  });

  it('из наложившихся узлов берёт верхний — последний в списке', () => {
    const stacked = [box('under', 0, 0), box('over', 10, 10)];
    expect(nodeAt(stacked, 50, 30)).toBe('over');
  });
});
