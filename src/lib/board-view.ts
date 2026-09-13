/* Вид доски связей: какая часть поля видна в окне прокрутки. */

type Point = { x: number; y: number };
type Size = { width: number; height: number };
type Scroll = { left: number; top: number };

/**
 * Отступ поля от края распорки по одной оси. Пока поле шире окна, распорка
 * ровно по нему и отступа нет; на мелком масштабе поле меньше окна, распорка
 * тянется до края окна, а поле встаёт посередине.
 */
function inset(viewport: number, field: number, zoom: number) {
  return Math.max(0, (viewport - field * zoom) / 2);
}

/**
 * Прокрутка, при которой точка поля встаёт в центр окна.
 *
 * Точка и поле — в пикселях на 100%: масштаб умножает их, а не саму прокрутку.
 * Выход за края не обрезаем — это делает сам браузер.
 */
export function scrollToCenter(point: Point, zoom: number, viewport: Size, field: Size): Scroll {
  return {
    left: inset(viewport.width, field.width, zoom) + point.x * zoom - viewport.width / 2,
    top: inset(viewport.height, field.height, zoom) + point.y * zoom - viewport.height / 2,
  };
}

/** Точка поля (в пикселях на 100%), что сейчас в центре окна. */
export function centerOf(scroll: Scroll, zoom: number, viewport: Size, field: Size): Point {
  return {
    x: (scroll.left + viewport.width / 2 - inset(viewport.width, field.width, zoom)) / zoom,
    y: (scroll.top + viewport.height / 2 - inset(viewport.height, field.height, zoom)) / zoom,
  };
}
