import { describe, expect, it } from 'vitest';
import {
  clampCrop,
  cropFileType,
  cropPixels,
  moveCrop,
  parseCrop,
  resizeCrop,
  FULL_CROP,
  MIN_SIDE,
} from './crop';

describe('clampCrop', () => {
  it('оставляет рамку внутри картинки', () => {
    expect(clampCrop({ x: -0.3, y: 1.2, w: 0.5, h: 0.5 })).toEqual({
      x: 0,
      y: 0.5,
      w: 0.5,
      h: 0.5,
    });
  });

  it('не даёт схлопнуть сторону в точку', () => {
    const rect = clampCrop({ x: 0.5, y: 0.5, w: 0, h: 0 });
    expect(rect.w).toBe(MIN_SIDE);
    expect(rect.h).toBe(MIN_SIDE);
  });
});

describe('moveCrop', () => {
  it('двигает рамку целиком, не меняя размер', () => {
    expect(moveCrop({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 }, 0.1, -0.1)).toEqual({
      x: 0.30000000000000004,
      y: 0.1,
      w: 0.4,
      h: 0.4,
    });
  });

  it('упирается в край, а не уезжает за картинку', () => {
    expect(moveCrop({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, 5, 5)).toEqual({
      x: 0.5,
      y: 0.5,
      w: 0.5,
      h: 0.5,
    });
  });
});

describe('resizeCrop', () => {
  const rect = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 };

  it('держит противоположный угол на месте', () => {
    const next = resizeCrop(rect, 'nw', 0.1, 0.1);
    expect(next.x + next.w).toBeCloseTo(0.6);
    expect(next.y + next.h).toBeCloseTo(0.6);
    expect(next.x).toBeCloseTo(0.3);
    expect(next.y).toBeCloseTo(0.3);
  });

  it('растит рамку от юго-восточного угла', () => {
    const next = resizeCrop(rect, 'se', 0.2, 0.1);
    expect(next).toEqual({ x: 0.2, y: 0.2, w: 0.6000000000000001, h: 0.5 });
  });

  it('не выворачивает рамку наизнанку, когда угол тянут за противоположный', () => {
    const next = resizeCrop(rect, 'nw', 1, 1);
    expect(next.w).toBeCloseTo(MIN_SIDE);
    expect(next.h).toBeCloseTo(MIN_SIDE);
    expect(next.x + next.w).toBeCloseTo(0.6);
  });

  it('не вылезает за картинку при растяжении', () => {
    const next = resizeCrop(rect, 'se', 5, 5);
    expect(next.x + next.w).toBeCloseTo(1);
    expect(next.y + next.h).toBeCloseTo(1);
  });
});

describe('cropPixels', () => {
  it('переводит доли в пиксели исходника', () => {
    expect(cropPixels({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, 800, 400)).toEqual({
      sx: 200,
      sy: 200,
      sw: 400,
      sh: 100,
    });
  });

  it('после округления не выходит за границу', () => {
    const { sx, sw } = cropPixels({ x: 0.999, y: 0, w: 1, h: 1 }, 100, 100);
    expect(sx + sw).toBeLessThanOrEqual(100);
  });

  it('полный кадр — вся картинка', () => {
    expect(cropPixels(FULL_CROP, 640, 480)).toEqual({ sx: 0, sy: 0, sw: 640, sh: 480 });
  });
});

describe('parseCrop', () => {
  it('читает то, что сами и записали', () => {
    expect(parseCrop({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 })).toEqual({
      x: 0.1,
      y: 0.2,
      w: 0.3,
      h: 0.4,
    });
  });

  it('молчит на пустом и на мусоре', () => {
    expect(parseCrop(null)).toBeNull();
    expect(parseCrop('0,0,1,1')).toBeNull();
    expect(parseCrop({ x: 0, y: 0, w: 1 })).toBeNull();
    expect(parseCrop({ x: 0, y: 0, w: 1, h: Number.NaN })).toBeNull();
  });

  it('чинит вышедшую за края рамку вместо того, чтобы её выбросить', () => {
    expect(parseCrop({ x: 0.9, y: 0, w: 0.5, h: 1 })).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 });
  });
});

describe('cropFileType', () => {
  it('сохраняет формат исходника, когда canvas его умеет', () => {
    expect(cropFileType('/uploads/a.jpg').type).toBe('image/jpeg');
    expect(cropFileType('/uploads/a.jpeg').type).toBe('image/jpeg');
    expect(cropFileType('/uploads/a.webp').type).toBe('image/webp');
    expect(cropFileType('/uploads/a.png').type).toBe('image/png');
  });

  it('всё, чего canvas не отдаёт, уходит в png', () => {
    expect(cropFileType('/uploads/a.gif').type).toBe('image/png');
    expect(cropFileType('/uploads/a.avif').type).toBe('image/png');
  });

  it('не спотыкается о query у адреса из Blob', () => {
    expect(cropFileType('https://x.public.blob.vercel-storage.com/uploads/a.jpg?v=2').type).toBe(
      'image/jpeg',
    );
  });
});
