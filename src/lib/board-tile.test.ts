import { describe, expect, it } from 'vitest';
import {
  NODE_HEIGHT_MAX,
  NODE_HEIGHT_MIN,
  NODE_WIDTH_MAX,
  NODE_WIDTH_MIN,
  TILE_SCALE_DEFAULT,
  TILE_SCALE_STEPS,
  clampNodeBox,
  gripOf,
  resizedBox,
  tileCenter,
  tileScaleStepFrom,
} from './board-tile';

const BOARD = { width: 1500, height: 900 };

describe('clampNodeBox', () => {
  it('держит ширину и высоту в пределах независимо и округляет до пикселя', () => {
    expect(clampNodeBox(10, 9999)).toEqual({ width: NODE_WIDTH_MIN, height: NODE_HEIGHT_MAX });
    expect(clampNodeBox(9999, 1)).toEqual({ width: NODE_WIDTH_MAX, height: NODE_HEIGHT_MIN });
    expect(clampNodeBox(240.6, 71.2)).toEqual({ width: 241, height: 71 });
  });

  it('мусор превращает в размер по умолчанию, а не в NaN в базе', () => {
    expect(clampNodeBox(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({
      width: 140,
      height: NODE_HEIGHT_MIN,
    });
  });
});

describe('resizedBox', () => {
  const tile = { left: 300, top: 200, width: 140, height: 60 };

  it('без движения размер не меняется, даже если угол взяли с промахом', () => {
    const grip = gripOf(tile, { x: 437, y: 262 }, 1);
    expect(resizedBox(grip, { x: 437, y: 262 })).toEqual({ width: 140, height: 60 });
  });

  it('ширина и высота идут за рукой каждая сама по себе', () => {
    const grip = gripOf(tile, { x: 440, y: 260 }, 1);
    expect(resizedBox(grip, { x: 600, y: 260 })).toEqual({ width: 300, height: 60 });
    expect(resizedBox(grip, { x: 440, y: 340 })).toEqual({ width: 140, height: 140 });
  });

  it('на увеличенных плитках пиксель руки — меньше пикселя плитки', () => {
    /* Плитка 140×60 нарисована вдвое крупнее: угол на 300+280, 200+120. */
    const grip = gripOf(tile, { x: 580, y: 320 }, 2);
    expect(resizedBox(grip, { x: 680, y: 360 })).toEqual({ width: 190, height: 80 });
  });

  it('не выходит за пределы', () => {
    const grip = gripOf(tile, { x: 440, y: 260 }, 1);
    expect(resizedBox(grip, { x: 0, y: 0 })).toEqual({
      width: NODE_WIDTH_MIN,
      height: NODE_HEIGHT_MIN,
    });
  });
});

describe('tileCenter', () => {
  it('центр — левый верхний угол плюс половина нарисованного размера', () => {
    expect(
      tileCenter({ left: 300, top: 180, scale: 1 }, { width: 300, height: 90 }, BOARD),
    ).toEqual({ x: 30, y: 25 });
    expect(
      tileCenter({ left: 300, top: 180, scale: 2 }, { width: 150, height: 45 }, BOARD),
    ).toEqual({ x: 30, y: 25 });
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
