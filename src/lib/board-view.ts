/* Вид доски связей: какая часть поля видна в окне прокрутки. */

type Point = { x: number; y: number };
type Size = { width: number; height: number };
type Scroll = { left: number; top: number };

/* Собственный размер полотна: он не зависит от ширины колонки, поэтому
 * координаты узлов (проценты) всегда ложатся в одну и ту же систему, а
 * места хватает, чтобы двигать доску даже на 100%. В макете было 900×560,
 * но там доска и не двигалась. */
export const BOARD_WIDTH = 1500;
export const BOARD_HEIGHT = 900;
export const BOARD = { width: BOARD_WIDTH, height: BOARD_HEIGHT };

/* Пустое поле вокруг полотна со всех сторон. Без него прокрутка начиналась
 * ровно с угла полотна, и доску можно было потянуть только вправо и вниз:
 * левый и верхний край упирались в ноль. Координаты узлов по-прежнему
 * проценты полотна, но узел ставится и на поле: за полотном они просто
 * меньше нуля или больше ста. */
export const BOARD_MARGIN = 600;
export const FIELD_WIDTH = BOARD_WIDTH + BOARD_MARGIN * 2;
export const FIELD_HEIGHT = BOARD_HEIGHT + BOARD_MARGIN * 2;
export const FIELD = { width: FIELD_WIDTH, height: FIELD_HEIGHT };

/* Центр узла не подходит к краю поля ближе 3% полотна — та же полоса, что
 * прежде оставалась у края самого полотна. */
const EDGE = 3;
const MARGIN_X = (BOARD_MARGIN / BOARD_WIDTH) * 100;
const MARGIN_Y = (BOARD_MARGIN / BOARD_HEIGHT) * 100;

function clampAxis(value: number, margin: number) {
  if (!Number.isFinite(value)) return 50;
  const clamped = Math.min(100 + margin - EDGE, Math.max(-margin + EDGE, value));
  return Math.round(clamped * 100) / 100;
}

/** Центр узла в процентах полотна: в пределах поля и с точностью до сотой —
 *  сотая процента меньше пикселя, угол при растягивании не уходит. */
export function clampBoardPoint(point: Point): Point {
  return { x: clampAxis(point.x, MARGIN_X), y: clampAxis(point.y, MARGIN_Y) };
}

/* Центр карточки превью не ближе этой доли стороны рамки к её краю: карточка
 * шириной 11% и высотой в две строки помещается целиком, а не срезается. */
const PREVIEW_PAD = 0.07;

type Axis = { min: number; max: number };

/** Сторона рамки, которой хватает по одной оси: рамка накрывает полотно
 *  (0…100), а крайние центры отстоят от её краёв на отступ. Разность любого
 *  края рамки с любым другим не больше стороны — отсюда четыре условия. */
function spanFor({ min, max }: Axis) {
  return Math.max(
    100,
    max / (1 - PREVIEW_PAD),
    (100 - min) / (1 - PREVIEW_PAD),
    (max - min) / (1 - 2 * PREVIEW_PAD),
  );
}

/** Начало рамки по оси: всё нужное посередине стороны. */
function startOf({ min, max }: Axis, span: number) {
  const low = Math.min(0, min - PREVIEW_PAD * span);
  const high = Math.max(100, max + PREVIEW_PAD * span);
  return low - (span - (high - low)) / 2;
}

/**
 * Рамка превью на «Хронике» в процентах полотна: всё полотно и все узлы,
 * вынесенные на поле, — иначе они пропадали бы за краем превью.
 *
 * Превью в пропорции полотна 5:3, а в процентах полотна это квадрат: сторона
 * одна на обе оси, лишнее делится поровну. Раскладка, что не подходит к краю
 * полотна, даёт рамку ровно по нему — превью выглядит как раньше.
 */
export function previewFrame(points: Point[]): { left: number; top: number; span: number } {
  if (points.length === 0) return { left: 0, top: 0, span: 100 };
  const x = {
    min: Math.min(...points.map((point) => point.x)),
    max: Math.max(...points.map((point) => point.x)),
  };
  const y = {
    min: Math.min(...points.map((point) => point.y)),
    max: Math.max(...points.map((point) => point.y)),
  };
  const span = Math.max(spanFor(x), spanFor(y));
  return { left: startOf(x, span), top: startOf(y, span), span };
}

/* Масштаб доски — в целых процентах: шаги по 10% и 20% в дробях копили бы
 * ошибку, и после десятка щелчков колёсика подпись показывала бы 99%. */
export const ZOOM_MIN = 20;
export const ZOOM_MAX = 200;
export const ZOOM_DEFAULT = 100;
/** Кнопки «−» и «+». */
export const ZOOM_BUTTON_STEP = 20;
/** Один щелчок колёсика. */
export const ZOOM_WHEEL_STEP = 10;

function clampZoom(percent: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, percent));
}

/** Масштаб после щелчка колёсика: вверх (deltaY < 0) — крупнее. */
export function zoomByWheel(percent: number, deltaY: number) {
  if (deltaY === 0) return percent;
  return clampZoom(percent + (deltaY < 0 ? ZOOM_WHEEL_STEP : -ZOOM_WHEEL_STEP));
}

/** Масштаб после кнопки: к соседней ступени по 20%. Со 110% «+» ведёт на 120%,
 *  а не на 130% — иначе после колёсика кнопки уже не попадали бы в ступени. */
export function zoomByButton(percent: number, direction: 1 | -1) {
  const step = ZOOM_BUTTON_STEP;
  const next =
    direction > 0
      ? (Math.floor(percent / step) + 1) * step
      : (Math.ceil(percent / step) - 1) * step;
  return clampZoom(next);
}

/** Масштаб после щипка: во столько же раз, во сколько развели пальцы.
 *  Считается от масштаба начала жеста, а не от текущего — иначе округление
 *  до целого процента копилось бы за сотню событий касания. Пальцы, сошедшиеся
 *  в точку, дают деление на ноль: масштаб тогда не трогаем. */
export function zoomByPinch(percent: number, ratio: number) {
  if (!Number.isFinite(ratio) || ratio <= 0) return percent;
  return clampZoom(Math.round(percent * ratio));
}

/** Расстояние между пальцами и точка посередине: щипок берёт из них масштаб
 *  и место, которое остаётся под пальцами. */
export function pinchOf(a: Point, b: Point): { distance: number; middle: Point } {
  return {
    distance: Math.hypot(a.x - b.x, a.y - b.y),
    middle: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  };
}

/**
 * Отступ поля от края распорки по одной оси. Пока поле шире окна, распорка
 * ровно по нему и отступа нет; на мелком масштабе поле меньше окна, распорка
 * тянется до края окна, а поле встаёт посередине.
 */
function inset(viewport: number, field: number, zoom: number) {
  return Math.max(0, (viewport - field * zoom) / 2);
}

/** Центр окна в пикселях от его левого верхнего угла. */
export function middleOf(viewport: Size): Point {
  return { x: viewport.width / 2, y: viewport.height / 2 };
}

/**
 * Прокрутка, при которой точка поля встаёт в место окна `at` — в пикселях от
 * его левого верхнего угла. Колёсико держит так точку под курсором.
 *
 * Точка и поле — в пикселях на 100%: масштаб умножает их, а не саму прокрутку.
 * Выход за края не обрезаем — это делает сам браузер.
 */
export function scrollToPlace(
  point: Point,
  zoom: number,
  viewport: Size,
  field: Size,
  at: Point,
): Scroll {
  return {
    left: inset(viewport.width, field.width, zoom) + point.x * zoom - at.x,
    top: inset(viewport.height, field.height, zoom) + point.y * zoom - at.y,
  };
}

/** Точка поля (в пикселях на 100%), что сейчас в месте окна `at`. */
export function pointAt(
  scroll: Scroll,
  zoom: number,
  viewport: Size,
  field: Size,
  at: Point,
): Point {
  return {
    x: (scroll.left + at.x - inset(viewport.width, field.width, zoom)) / zoom,
    y: (scroll.top + at.y - inset(viewport.height, field.height, zoom)) / zoom,
  };
}

/** Прокрутка, при которой точка поля встаёт в центр окна. */
export function scrollToCenter(point: Point, zoom: number, viewport: Size, field: Size): Scroll {
  return scrollToPlace(point, zoom, viewport, field, middleOf(viewport));
}

/** Точка поля (в пикселях на 100%), что сейчас в центре окна. */
export function centerOf(scroll: Scroll, zoom: number, viewport: Size, field: Size): Point {
  return pointAt(scroll, zoom, viewport, field, middleOf(viewport));
}
