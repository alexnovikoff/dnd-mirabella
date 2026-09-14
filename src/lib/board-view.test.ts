import { describe, expect, it } from 'vitest';
import { FIELD, centerOf, clampBoardPoint, previewFrame, scrollToCenter } from './board-view';

const viewport = { width: 1000, height: 600 };
const field = { width: 2700, height: 2100 };

describe('поле доски', () => {
  it('полотно 1500×900 и по 600px вокруг', () => {
    expect(FIELD).toEqual(field);
  });
});

describe('clampBoardPoint', () => {
  it('пускает центр узла за полотно, на поле вокруг', () => {
    expect(clampBoardPoint({ x: -20, y: 150 })).toEqual({ x: -20, y: 150 });
    expect(clampBoardPoint({ x: 120, y: -50 })).toEqual({ x: 120, y: -50 });
  });

  it('держит центр в 3% полотна от края поля', () => {
    /* Поле — 600px по бокам: 40% ширины полотна и 66,67% высоты. */
    expect(clampBoardPoint({ x: -100, y: -100 })).toEqual({ x: -37, y: -63.67 });
    expect(clampBoardPoint({ x: 500, y: 500 })).toEqual({ x: 137, y: 163.67 });
  });

  it('округляет до сотой, мусор ставит в середину полотна', () => {
    expect(clampBoardPoint({ x: 41.23456, y: 7.891 })).toEqual({ x: 41.23, y: 7.89 });
    expect(clampBoardPoint({ x: Number.NaN, y: Number.POSITIVE_INFINITY })).toEqual({
      x: 50,
      y: 50,
    });
  });
});

describe('previewFrame', () => {
  type Frame = ReturnType<typeof previewFrame>;
  /** Центр карточки в процентах превью. */
  const inPreview = (frame: Frame, point: { x: number; y: number }) => ({
    x: ((point.x - frame.left) / frame.span) * 100,
    y: ((point.y - frame.top) / frame.span) * 100,
  });

  it('раскладка не у края полотна — рамка ровно по полотну, как было', () => {
    const points = [
      { x: 8, y: 12 },
      { x: 88, y: 88 },
      { x: 50, y: 40 },
    ];
    expect(previewFrame(points)).toEqual({ left: 0, top: 0, span: 100 });
    expect(previewFrame([])).toEqual({ left: 0, top: 0, span: 100 });
  });

  it('узел за полотном расширяет рамку, пропорция полотна сохраняется', () => {
    const frame = previewFrame([{ x: 127, y: 50 }]);
    /* Справа ровно отступ, по высоте добавка поровну сверху и снизу: в
     * процентах полотна пропорция 5:3 — это квадрат. */
    expect(inPreview(frame, { x: 127, y: 50 }).x).toBeCloseTo(93);
    expect(frame.left).toBeCloseTo(0);
    expect(frame.top).toBeCloseTo(-(frame.span - 100) / 2);
  });

  it('узлы за разными краями — все в превью и полотно тоже', () => {
    const points = [
      { x: -37, y: -63.67 },
      { x: 137, y: 163.67 },
      { x: -17, y: 50 },
    ];
    const frame = previewFrame(points);
    for (const point of points) {
      const { x, y } = inPreview(frame, point);
      for (const value of [x, y]) {
        expect(value).toBeGreaterThanOrEqual(7 - 1e-9);
        expect(value).toBeLessThanOrEqual(93 + 1e-9);
      }
    }
    expect(frame.left).toBeLessThanOrEqual(0);
    expect(frame.top).toBeLessThanOrEqual(0);
    expect(frame.left + frame.span).toBeGreaterThanOrEqual(100);
    /* Сторона по длинной оси — по высоте поле вдвое глубже. */
    expect(inPreview(frame, points[0]).y).toBeCloseTo(7);
    expect(inPreview(frame, points[1]).y).toBeCloseTo(93);
  });

  it('узел у самого края полотна не срезается краем превью', () => {
    const frame = previewFrame([{ x: 97, y: 3 }]);
    const { x, y } = inPreview(frame, { x: 97, y: 3 });
    expect(x).toBeCloseTo(93);
    expect(y).toBeCloseTo(7);
  });
});

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
