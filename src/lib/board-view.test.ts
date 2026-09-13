import { describe, expect, it } from 'vitest';
import { centerOf, scrollToCenter } from './board-view';

const viewport = { width: 1000, height: 600 };
const field = { width: 2700, height: 2100 };

describe('scrollToCenter', () => {
  it('ставит точку поля в центр окна с учётом масштаба', () => {
    expect(scrollToCenter({ x: 1350, y: 1050 }, 1, viewport, field)).toEqual({
      left: 850,
      top: 750,
    });
    expect(scrollToCenter({ x: 1350, y: 1050 }, 2, viewport, field)).toEqual({
      left: 2200,
      top: 1800,
    });
  });
});

describe('centerOf', () => {
  it('обратна scrollToCenter', () => {
    const point = { x: 700, y: 420 };
    expect(centerOf(scrollToCenter(point, 0.6, viewport, field), 0.6, viewport, field)).toEqual(
      point,
    );
  });

  it('при смене масштаба центр окна остаётся на той же точке поля', () => {
    const before = centerOf({ left: 300, top: 120 }, 1, viewport, field);
    const after = scrollToCenter(before, 1.4, viewport, field);
    expect(centerOf(after, 1.4, viewport, field)).toEqual(before);
  });

  it('поле меньше окна стоит посередине — в центре окна середина поля', () => {
    /* 2700×2100 на 20% — 540×420, прокручивать нечего. */
    expect(centerOf({ left: 0, top: 0 }, 0.2, viewport, field)).toEqual({ x: 1350, y: 1050 });
  });

  it('поле меньше окна лишь по одной оси — вторая считается как обычно', () => {
    /* На 40% поле 1080×840 в окне 1000×900: вбок прокрутка есть, по высоте нет. */
    const tall = { width: 1000, height: 900 };
    expect(centerOf({ left: 40, top: 0 }, 0.4, tall, field)).toEqual({ x: 1350, y: 1050 });
    expect(centerOf({ left: 0, top: 0 }, 0.4, tall, field)).toEqual({ x: 1250, y: 1050 });
  });
});
