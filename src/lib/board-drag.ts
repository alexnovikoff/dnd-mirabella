/* Жест «перетащить один узел на другой» на доске связей и в её превью. */

export type NodeBox = {
  id: string;
  /** Прямоугольник в координатах окна — как его отдаёт getBoundingClientRect. */
  rect: { left: number; right: number; top: number; bottom: number };
};

/**
 * Узел под точкой.
 *
 * Прямоугольники берутся настоящие, а не считаются от центра: ширина узла
 * зависит от длины имени, высота — от того, перенеслось ли имя на вторую
 * строку, а на доске всё это ещё и умножается на масштаб. Из наложившихся
 * узлов выигрывает последний: порядок тот же, что в DOM, значит он нарисован
 * выше. Перетаскиваемый узел в список не попадает — он под курсором всегда.
 */
export function nodeAt(boxes: NodeBox[], x: number, y: number): string | null {
  let found: string | null = null;
  for (const box of boxes) {
    const { left, right, top, bottom } = box.rect;
    if (x >= left && x <= right && y >= top && y <= bottom) found = box.id;
  }
  return found;
}
