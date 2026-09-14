/* Размер плиток на доске связей. Их два, и они складываются:
 * - размер узла — общий на кампанию, хранится рядом с координатами. Плитку
 *   тянут за нижний правый угол, как окно: ширина и высота независимы,
 *   левый верхний угол стоит на месте, текст переносится по новой ширине;
 * - множитель зрителя — у каждого свой, живёт в куке браузера. Им подгоняют
 *   доску под свой экран и масштаб, не трогая чужую раскладку. Кука, а не
 *   localStorage: её читает сервер, и доска сразу приходит с нужными
 *   плитками, а не перескакивает на них после гидрации.
 * Координаты узла — центр плитки: от него идут линии. */

/** Ширина плитки по умолчанию — та же, что у .node в Board.module.css. */
export const NODE_WIDTH_DEFAULT = 140;
/** Страховка для базы, а не настоящий предел: уже самого длинного слова плитку
 *  не пускает min-width: min-content. Постоянный минимум оставлял короткому
 *  имени («Бонсе») пустое поле справа втрое шире отступа слева. Ниже самой
 *  узкой плитки (имя в две буквы — около 36px), чтобы предел не вернулся. */
export const NODE_WIDTH_MIN = 24;
export const NODE_WIDTH_MAX = 600;
/** Высота — нижняя граница: содержимое всё равно не обрежется. */
export const NODE_HEIGHT_MIN = 24;
export const NODE_HEIGHT_MAX = 600;

/** Множитель зрителя: те же ступени по 20%, что у масштаба доски. */
export const TILE_SCALE_STEPS = [0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2] as const;
export const TILE_SCALE_DEFAULT = TILE_SCALE_STEPS.indexOf(1);
export const TILE_SCALE_COOKIE = 'board-tile-scale';

type Point = { x: number; y: number };
export type TileBox = { width: number; height: number };

/** Где ухватили угол. Всё в пикселях полотна на 100%, кроме offset: это
 *  промах мимо самого угла в пикселях плитки — без него она прыгала бы
 *  под указатель, если взяли не ровно за край. */
export type ResizeGrip = {
  left: number;
  top: number;
  offsetX: number;
  offsetY: number;
  /** Множитель зрителя: плитка нарисована во столько раз крупнее. */
  scale: number;
};

function clampInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function clampNodeBox(width: number, height: number): TileBox {
  return {
    width: clampInt(width, NODE_WIDTH_MIN, NODE_WIDTH_MAX, NODE_WIDTH_DEFAULT),
    height: clampInt(height, NODE_HEIGHT_MIN, NODE_HEIGHT_MAX, NODE_HEIGHT_MIN),
  };
}

/** Хватка в момент нажатия: плитка с левым верхним углом и размером
 *  (в пикселях плитки) и указатель — в пикселях полотна. */
export function gripOf(
  tile: { left: number; top: number; width: number; height: number },
  pointer: Point,
  scale: number,
): ResizeGrip {
  return {
    left: tile.left,
    top: tile.top,
    offsetX: (pointer.x - tile.left) / scale - tile.width,
    offsetY: (pointer.y - tile.top) / scale - tile.height,
    scale,
  };
}

/** Размер плитки под указателем: левый верхний угол стоит, нижний правый
 *  идёт за рукой. */
export function resizedBox(grip: ResizeGrip, pointer: Point): TileBox {
  return clampNodeBox(
    (pointer.x - grip.left) / grip.scale - grip.offsetX,
    (pointer.y - grip.top) / grip.scale - grip.offsetY,
  );
}

/** Центр плитки в процентах полотна по её левому верхнему углу и
 *  нарисованному размеру. */
export function tileCenter(
  grip: Pick<ResizeGrip, 'left' | 'top' | 'scale'>,
  box: TileBox,
  board: TileBox,
): Point {
  return {
    x: ((grip.left + (box.width * grip.scale) / 2) / board.width) * 100,
    y: ((grip.top + (box.height * grip.scale) / 2) / board.height) * 100,
  };
}

/** Ступень множителя из куки; всё незнакомое — обычный размер. */
export function tileScaleStepFrom(stored: string | null | undefined): number {
  const step = TILE_SCALE_STEPS.findIndex((value) => String(value) === stored);
  return step === -1 ? TILE_SCALE_DEFAULT : step;
}
