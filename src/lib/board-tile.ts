/* Размер плиток на доске связей. Их два, и они перемножаются:
 * - размер узла — общий на кампанию, хранится рядом с координатами;
 * - множитель зрителя — у каждого свой, живёт в куке браузера. Им подгоняют
 *   доску под свой экран и масштаб, не трогая чужую раскладку. Кука, а не
 *   localStorage: её читает сервер, и доска сразу приходит с нужными
 *   плитками, а не перескакивает на них после гидрации.
 * Ни то, ни другое не двигает узлы: координаты — центр плитки. */

/** Пределы размера узла, в процентах от обычной плитки. */
export const NODE_SIZE_MIN = 50;
export const NODE_SIZE_MAX = 300;
export const NODE_SIZE_DEFAULT = 100;
/** Шаг стрелок на ручке. */
export const NODE_SIZE_STEP = 10;

/** Множитель зрителя: те же ступени по 20%, что у масштаба доски. */
export const TILE_SCALE_STEPS = [0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2] as const;
export const TILE_SCALE_DEFAULT = TILE_SCALE_STEPS.indexOf(1);
export const TILE_SCALE_COOKIE = 'board-tile-scale';

export function clampNodeSize(size: number): number {
  if (!Number.isFinite(size)) return NODE_SIZE_DEFAULT;
  return Math.min(NODE_SIZE_MAX, Math.max(NODE_SIZE_MIN, Math.round(size)));
}

/**
 * Размер узла, пока тянут ручку.
 *
 * Считается отношением расстояний от центра плитки: где указатель сейчас
 * и где его прижали. Абсолютную ширину брать нельзя — она зависит от длины
 * имени, масштаба доски и множителя зрителя, а отношение от них свободно.
 * К тому же плитка не прыгает, если ручку взяли не ровно за угол.
 */
export function resizedNodeSize(
  startSize: number,
  startDistance: number,
  distance: number,
): number {
  if (startDistance <= 0) return clampNodeSize(startSize);
  return clampNodeSize((startSize * distance) / startDistance);
}

/** Ступень множителя из куки; всё незнакомое — обычный размер. */
export function tileScaleStepFrom(stored: string | null | undefined): number {
  const step = TILE_SCALE_STEPS.findIndex((value) => String(value) === stored);
  return step === -1 ? TILE_SCALE_DEFAULT : step;
}
