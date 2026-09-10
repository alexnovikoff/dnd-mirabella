/* Рамка кадра портрета.
 *
 * Храним долями исходника, а не пикселями: один и тот же прямоугольник
 * переживает и замену файла на другой размер, и превью в диалоге, где
 * картинка ужата под окно. Пиксели считаются в последний момент —
 * когда кадр уходит в canvas.
 */

export type CropRect = { x: number; y: number; w: number; h: number };

/** Картинка целиком — состояние «ещё не кадрировали». */
export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

/** Меньше этой доли стороны рамка не сжимается: кадр в пару пикселей
 *  ни показать, ни поймать мышью. */
export const MIN_SIDE = 0.05;

/** За какой угол тянут. Стороны намеренно не заводим: углов хватает,
 *  а попаданий по мелким маркерам становится вдвое меньше. */
export type Handle = 'nw' | 'ne' | 'sw' | 'se';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Загоняет рамку внутрь картинки. */
export function clampCrop(rect: CropRect): CropRect {
  const w = clamp(rect.w, MIN_SIDE, 1);
  const h = clamp(rect.h, MIN_SIDE, 1);
  return { x: clamp(rect.x, 0, 1 - w), y: clamp(rect.y, 0, 1 - h), w, h };
}

/** Сдвиг рамки целиком. У края она упирается, а не уезжает за картинку:
 *  так курсор можно вести дальше и вернуться, не потеряв кадр. */
export function moveCrop(rect: CropRect, dx: number, dy: number): CropRect {
  return clampCrop({ ...rect, x: rect.x + dx, y: rect.y + dy });
}

/** Тянем за угол: противоположный остаётся на месте. */
export function resizeCrop(rect: CropRect, handle: Handle, dx: number, dy: number): CropRect {
  const west = handle === 'nw' || handle === 'sw';
  const north = handle === 'nw' || handle === 'ne';
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;

  let { x, y, w, h } = rect;

  if (west) {
    x = clamp(rect.x + dx, 0, right - MIN_SIDE);
    w = right - x;
  } else {
    w = clamp(rect.w + dx, MIN_SIDE, 1 - rect.x);
  }

  if (north) {
    y = clamp(rect.y + dy, 0, bottom - MIN_SIDE);
    h = bottom - y;
  } else {
    h = clamp(rect.h + dy, MIN_SIDE, 1 - rect.y);
  }

  return { x, y, w, h };
}

/** Рамка в пикселях исходника — аргументы для drawImage. Округление
 *  прижимаем к краю, чтобы вылезший на пиксель кадр не дал пустую полосу. */
export function cropPixels(rect: CropRect, width: number, height: number) {
  const sw = clamp(Math.round(rect.w * width), 1, width);
  const sh = clamp(Math.round(rect.h * height), 1, height);
  return {
    sx: clamp(Math.round(rect.x * width), 0, width - sw),
    sy: clamp(Math.round(rect.y * height), 0, height - sh),
    sw,
    sh,
  };
}

/** Что пришло из базы. Колонка появилась позже портретов, у старых
 *  персонажей там null, а руками туда мог попасть и мусор. */
export function parseCrop(value: unknown): CropRect | null {
  if (typeof value !== 'object' || value === null) return null;

  const { x, y, w, h } = value as Record<string, unknown>;
  const numbers = [x, y, w, h];
  if (!numbers.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;

  return clampCrop({ x, y, w, h } as CropRect);
}

/** Формат готового кадра. canvas умеет png, jpeg и webp; всё остальное
 *  (gif, avif) уезжает в png — так не теряется прозрачность. */
export function cropFileType(sourceUrl: string): { type: string; name: string } {
  const extension = sourceUrl.split(/[?#]/)[0].split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return { type: 'image/jpeg', name: 'crop.jpg' };
  if (extension === 'webp') return { type: 'image/webp', name: 'crop.webp' };
  return { type: 'image/png', name: 'crop.png' };
}
