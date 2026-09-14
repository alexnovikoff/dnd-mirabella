import { describe, expect, it } from 'vitest';
import {
  NODE_SIZE_MAX,
  NODE_SIZE_MIN,
  TILE_SCALE_DEFAULT,
  TILE_SCALE_STEPS,
  clampNodeSize,
  resizedNodeSize,
  tileScaleStepFrom,
} from './board-tile';

describe('clampNodeSize', () => {
  it('держит размер в пределах и округляет до процента', () => {
    expect(clampNodeSize(10)).toBe(NODE_SIZE_MIN);
    expect(clampNodeSize(1000)).toBe(NODE_SIZE_MAX);
    expect(clampNodeSize(142.6)).toBe(143);
  });

  it('мусор превращает в обычный размер, а не в NaN в базе', () => {
    expect(clampNodeSize(Number.NaN)).toBe(100);
    expect(clampNodeSize(Number.POSITIVE_INFINITY)).toBe(100);
  });
});

describe('resizedNodeSize', () => {
  it('растёт вместе с расстоянием от центра', () => {
    expect(resizedNodeSize(100, 80, 120)).toBe(150);
    expect(resizedNodeSize(150, 120, 60)).toBe(75);
  });

  it('без движения размер не меняется, даже если ручку взяли не за угол', () => {
    expect(resizedNodeSize(120, 37, 37)).toBe(120);
  });

  it('не выходит за пределы', () => {
    expect(resizedNodeSize(100, 50, 5)).toBe(NODE_SIZE_MIN);
    expect(resizedNodeSize(100, 50, 5000)).toBe(NODE_SIZE_MAX);
  });

  it('нулевое начальное расстояние не делит на ноль', () => {
    expect(resizedNodeSize(130, 0, 40)).toBe(130);
  });
});

describe('tileScaleStepFrom', () => {
  it('узнаёт сохранённую ступень', () => {
    expect(TILE_SCALE_STEPS[tileScaleStepFrom('1.4')]).toBe(1.4);
    expect(TILE_SCALE_STEPS[tileScaleStepFrom('0.6')]).toBe(0.6);
  });

  it('пустое и чужое значение — обычный размер', () => {
    expect(tileScaleStepFrom(undefined)).toBe(TILE_SCALE_DEFAULT);
    expect(tileScaleStepFrom(null)).toBe(TILE_SCALE_DEFAULT);
    expect(tileScaleStepFrom('1.3')).toBe(TILE_SCALE_DEFAULT);
    expect(tileScaleStepFrom('abc')).toBe(TILE_SCALE_DEFAULT);
  });
});
