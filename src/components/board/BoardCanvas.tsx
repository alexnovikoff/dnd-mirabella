'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MonoLabel } from '@/components/primitives';
import { saveNodeBox, saveNodePosition } from '@/lib/actions/board';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { LinkTypeDialog } from './LinkTypeDialog';
import { nodeAt, type NodeBox } from '@/lib/board-drag';
import {
  TILE_SCALE_COOKIE,
  TILE_SCALE_DEFAULT,
  TILE_SCALE_STEPS,
  gripOf,
  resizedBox,
  tileCenter,
  type ResizeGrip,
} from '@/lib/board-tile';
import {
  BOARD,
  BOARD_HEIGHT,
  BOARD_MARGIN,
  BOARD_WIDTH,
  FIELD,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  clampBoardPoint,
  middleOf,
  pinchOf,
  pointAt,
  scrollToCenter,
  scrollToPlace,
  zoomByButton,
  zoomByPinch,
  zoomByWheel,
} from '@/lib/board-view';
import { NODE_KIND_LABEL } from '@/lib/nodes';
import type { BoardEdge, BoardNode } from '@/lib/queries/board';
import styles from './Board.module.css';

/** Сдвиг больше этого — перетаскивание, меньше — клик. */
const DRAG_THRESHOLD = 4;

/* Мышь даёт одно событие колёсика на щелчок, а трекпад и колёса со свободным
 * вращением — десятки за жест. Шаг не чаще раза в 50 мс: щелчки мыши идут
 * реже, а жест трекпада не проносит весь масштаб за долю секунды. */
const WHEEL_STEP_INTERVAL = 50;

type Point = { x: number; y: number };

function viewportOf(scroller: HTMLElement) {
  return { width: scroller.clientWidth, height: scroller.clientHeight };
}

type NodeDrag = { id: string; movedFar: boolean };
/** Пара, которую связываем: открыто окно типа связи. */
type Linking = {
  from: BoardNode;
  to: BoardNode;
  /** Ручная связь этой пары уже есть — меняем её тип, а не плодим вторую. */
  linkId: string | null;
  label: string | null;
};
type Pan = {
  pointerId: number;
  x: number;
  y: number;
  left: number;
  top: number;
  movedFar: boolean;
};
/** Размер плитки; null — по умолчанию из CSS. */
type NodeSize = { width: number | null; height: number | null };
/** Плитку тянут за нижний правый угол. */
type Resize = {
  id: string;
  pointerId: number;
  grip: ResizeGrip;
  moved: boolean;
  /** Что вернуть, если жест прервут. */
  before: { size: NodeSize; position: { x: number; y: number } };
};

export function BoardCanvas({
  nodes,
  edges,
  labels,
  selectedSlug,
  initialTileStep,
}: {
  nodes: BoardNode[];
  edges: BoardEdge[];
  /** Уже использованные типы связи — подсказки в окне после дропа. */
  labels: string[];
  selectedSlug: string | null;
  /** Ступень множителя плиток из куки зрителя. */
  initialTileStep: number;
}) {
  const router = useRouter();
  const { canWrite } = useQuickEntry();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  /* Живые узлы: по их прямоугольникам ищем, на кого бросили. */
  const nodeRefs = useRef(new Map<string, HTMLElement>());

  /* Масштаб доски в целых процентах. Координаты узлов хранятся в процентах
   * полотна, поэтому масштаб — чисто визуальная штука: он ничего не
   * пересчитывает и никуда не сохраняется. Доска открывается на 100% на любом
   * экране, телефон тоже: имена узлов читаются, а до остального графа доска
   * дотягивается пальцем. */
  const [zoomPercent, setZoomPercent] = useState<number>(ZOOM_DEFAULT);
  const [drag, setDrag] = useState<NodeDrag | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [linking, setLinking] = useState<Linking | null>(null);
  const [pan, setPan] = useState<Pan | null>(null);
  const [resize, setResize] = useState<Resize | null>(null);
  /* Локальные координаты на время перетаскивания — линии едут за узлом. */
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  /* Так же и размеры: плитка растёт под рукой, в базу уходит итог. */
  const [sizes, setSizes] = useState<Record<string, NodeSize>>({});
  const [tileStep, setTileStep] = useState<number>(initialTileStep);

  const zoom = zoomPercent / 100;
  const tileScale = TILE_SCALE_STEPS[tileStep];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const selectedId = nodes.find((node) => node.slug === selectedSlug)?.id ?? null;

  /* Множитель плиток — настройка зрителя, а не кампании: у каждого свой
   * экран. Кука на год; страница прочтёт её при следующем заходе. */
  function tileScaleTo(step: number) {
    setTileStep(step);
    document.cookie = `${TILE_SCALE_COOKIE}=${TILE_SCALE_STEPS[step]}; path=/board; max-age=31536000; samesite=lax`;
  }

  const sizeOf = (node: BoardNode): NodeSize =>
    sizes[node.id] ?? { width: node.width, height: node.height };

  /** Точка окна в пикселях полотна на 100%. */
  function toCanvas(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * BOARD_WIDTH,
      y: ((clientY - rect.top) / rect.height) * BOARD_HEIGHT,
    };
  }

  /** Нарисованный размер плитки в её пикселях: он бывает больше заданного,
   *  если содержимое не помещается ни по ширине, ни по высоте. */
  function drawnSize(id: string) {
    const element = nodeRefs.current.get(id);
    return element ? { width: element.offsetWidth, height: element.offsetHeight } : null;
  }

  /* Масштаб, при котором поле сейчас отрисовано. */
  const zoomRef = useRef(zoom);
  /* Последний заказанный масштаб. Щелчки колёсика бывают чаще отрисовки, и
   * шаг от состояния потерял бы щелчок, пришедший до неё. */
  const targetRef = useRef<number>(ZOOM_DEFAULT);
  /* Точка поля и место окна, куда её вернуть после смены масштаба: для
   * кнопок это центр окна, для колёсика — курсор. Первый показ — середина
   * поля в центре окна: запас для перетаскивания есть во все стороны сразу. */
  const anchorRef = useRef<{ point: Point; at: Point | null } | null>({
    point: { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2 },
    at: null,
  });
  /* Что поставили прошлой сменой масштаба и какая прокрутка из этого вышла. */
  const placedRef = useRef<{
    point: Point;
    at: Point;
    zoom: number;
    left: number;
    top: number;
  } | null>(null);

  /* Масштаб меняет размер поля, а прокрутка остаётся в пикселях — без
   * поправки вид уезжал бы к углу. Точку снимаем до смены: после неё
   * прокрутку уже не прочесть — на меньшем поле браузер её обрезает.
   * `at` — место в окне, которое стоит на месте; без него — центр окна. */
  const zoomTo = useCallback((percent: number, at: Point | null = null) => {
    if (percent === targetRef.current) return;
    targetRef.current = percent;
    const scroller = scrollerRef.current;
    if (scroller) {
      const viewport = viewportOf(scroller);
      const place = at ?? middleOf(viewport);
      const scroll = { left: scroller.scrollLeft, top: scroller.scrollTop };
      /* Браузер округляет прокрутку до пикселя, и точка, снятая с неё заново,
       * на каждом шаге смещалась на полпикселя — всегда в ту же сторону:
       * одно округление подталкивает следующее. За два десятка щелчков узел
       * отъезжал из-под курсора пикселей на десять. Пока курсор и прокрутка
       * те же, что после прошлого шага, точка берётся оттуда, неокруглённой. */
      const placed = placedRef.current;
      const kept =
        placed &&
        placed.zoom === zoomRef.current &&
        placed.left === scroll.left &&
        placed.top === scroll.top &&
        placed.at.x === place.x &&
        placed.at.y === place.y;
      anchorRef.current = {
        point: kept ? placed.point : pointAt(scroll, zoomRef.current, viewport, FIELD, place),
        at: place,
      };
    }
    setZoomPercent(percent);
  }, []);

  /* До отрисовки — иначе мелькнул бы пустой угол поля. */
  useLayoutEffect(() => {
    zoomRef.current = zoom;
    const scroller = scrollerRef.current;
    const anchor = anchorRef.current;
    if (!scroller || !anchor) return;
    anchorRef.current = null;

    const viewport = viewportOf(scroller);
    const at = anchor.at ?? middleOf(viewport);
    const { left, top } = scrollToPlace(anchor.point, zoom, viewport, FIELD, at);
    scroller.scrollLeft = left;
    scroller.scrollTop = top;
    placedRef.current = {
      point: anchor.point,
      at,
      zoom,
      left: scroller.scrollLeft,
      top: scroller.scrollTop,
    };
  }, [zoom]);

  /* Колёсико над доской меняет масштаб, а не прокручивает: двигают доску
   * перетаскиванием. Точка под курсором остаётся под ним, как на карте.
   * Слушатель свой, а не onWheel: React вешает колёсико пассивным, и
   * preventDefault в нём не остановил бы прокрутку. */
  const panning = pan !== null;
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let lastStep = -Infinity;

    function onWheel(event: WheelEvent) {
      /* Shift + колёсико и сдвиг трекпада вбок по-прежнему листают доску. */
      if (event.deltaY === 0 || !scroller) return;
      event.preventDefault();
      /* Пока доску тянут, прокрутку ведёт жест: он считает её от точки
       * старта в пикселях прежнего масштаба и сорвал бы вид на первом же
       * сдвиге. */
      if (panning) return;
      if (event.timeStamp - lastStep < WHEEL_STEP_INTERVAL) return;
      lastStep = event.timeStamp;

      const rect = scroller.getBoundingClientRect();
      zoomTo(zoomByWheel(targetRef.current, event.deltaY), {
        x: event.clientX - rect.left - scroller.clientLeft,
        y: event.clientY - rect.top - scroller.clientTop,
      });
    }

    scroller.addEventListener('wheel', onWheel, { passive: false });
    return () => scroller.removeEventListener('wheel', onWheel);
  }, [zoomTo, panning]);

  /* Что ведёт первый палец: щипок приходит из своего слушателя, вне рендера,
   * и состояния жестов ему видно только через ссылки. */
  const dragRef = useRef<NodeDrag | null>(null);
  const resizeRef = useRef<Resize | null>(null);
  useEffect(() => {
    dragRef.current = drag;
    resizeRef.current = resize;
  }, [drag, resize]);
  /* Пальцы, разводившие масштаб, не должны на отпускании сработать тапом по
   * плитке. Держим до конца касания: второй палец поднимают уже без щипка. */
  const pinchedRef = useRef(false);

  /* Щипок двумя пальцами масштабирует доску, как карту: расстояние между
   * пальцами задаёт масштаб, точка между ними остаётся между ними. На телефоне
   * это единственный привычный способ приблизить граф — кнопками «−» и «+»
   * до 200% идти десять нажатий.
   *
   * Слушатели касаний, а не указателей: `touches` сразу дают обе точки, а
   * главное — отменить системный зум можно только здесь. `touch-action: none`
   * его на iPhone не держит: Safari уводил жест себе, увеличивал страницу
   * целиком, а доска пальцев уже не видела. Слушатели не пассивные, иначе
   * preventDefault в них ничего не значит. */
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    /* Начало жеста: расстояние, масштаб и точка поля под серединой пальцев.
     * Точка снимается один раз — считанная заново на каждом событии, она
     * уползала бы на округлении прокрутки, как было у колёсика. */
    let pinch: { distance: number; percent: number; point: Point } | null = null;

    /** Расстояние между пальцами и их середина в пикселях от угла окна доски. */
    const measure = (touches: TouchList) => {
      const rect = scroller.getBoundingClientRect();
      const { distance, middle } = pinchOf(
        { x: touches[0].clientX, y: touches[0].clientY },
        { x: touches[1].clientX, y: touches[1].clientY },
      );
      return {
        distance,
        at: {
          x: middle.x - rect.left - scroller.clientLeft,
          y: middle.y - rect.top - scroller.clientTop,
        },
      };
    };

    /** Жесты первого пальца: на время щипка их отменяем — иначе узел уехал бы
     *  вместе с масштабом, а на отпускании ещё и сохранился. */
    const dropGestures = () => {
      setPan(null);
      const dragged = dragRef.current;
      if (dragged) {
        setPositions((current) => {
          const next = { ...current };
          delete next[dragged.id];
          return next;
        });
        setDrag(null);
        setDropTarget(null);
      }
      const resizing = resizeRef.current;
      if (resizing) {
        setSizes((current) => ({ ...current, [resizing.id]: resizing.before.size }));
        setPositions((current) => ({ ...current, [resizing.id]: resizing.before.position }));
        setResize(null);
      }
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      event.preventDefault();
      dropGestures();
      pinchedRef.current = true;
      const { distance, at } = measure(event.touches);
      pinch = {
        distance,
        percent: targetRef.current,
        point: pointAt(
          { left: scroller.scrollLeft, top: scroller.scrollTop },
          zoomRef.current,
          viewportOf(scroller),
          FIELD,
          at,
        ),
      };
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!pinch || event.touches.length < 2) return;
      event.preventDefault();
      const { distance, at } = measure(event.touches);
      const percent = zoomByPinch(pinch.percent, distance / pinch.distance);
      if (percent === targetRef.current) {
        /* Масштаб тот же — упёрся в предел или не набрал целого процента. Доска
         * всё равно едет за пальцами: точка жеста держится их середины. */
        const { left, top } = scrollToPlace(
          pinch.point,
          zoomRef.current,
          viewportOf(scroller),
          FIELD,
          at,
        );
        scroller.scrollLeft = left;
        scroller.scrollTop = top;
        placedRef.current = {
          point: pinch.point,
          at,
          zoom: zoomRef.current,
          left: scroller.scrollLeft,
          top: scroller.scrollTop,
        };
        return;
      }
      anchorRef.current = { point: pinch.point, at };
      targetRef.current = percent;
      setZoomPercent(percent);
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinch = null;
      /* Пока на экране остаётся хоть один палец, это всё тот же жест. */
      if (event.touches.length === 0) pinchedRef.current = false;
    };

    scroller.addEventListener('touchstart', onTouchStart, { passive: false });
    scroller.addEventListener('touchmove', onTouchMove, { passive: false });
    scroller.addEventListener('touchend', onTouchEnd);
    scroller.addEventListener('touchcancel', onTouchEnd);
    return () => {
      scroller.removeEventListener('touchstart', onTouchStart);
      scroller.removeEventListener('touchmove', onTouchMove);
      scroller.removeEventListener('touchend', onTouchEnd);
      scroller.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  /* Полотно больше окна, поэтому выбранный узел может оказаться за краем —
   * например при переходе по связи из панели. Подкручиваем к нему. */
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !selectedSlug) return;

    const node = nodes.find((item) => item.slug === selectedSlug);
    if (!node) return;

    const position = positions[node.id] ?? { x: node.x, y: node.y };
    const point = {
      x: BOARD_MARGIN + (BOARD_WIDTH * position.x) / 100,
      y: BOARD_MARGIN + (BOARD_HEIGHT * position.y) / 100,
    };
    scroller.scrollTo({
      ...scrollToCenter(point, zoom, viewportOf(scroller), FIELD),
      behavior: 'smooth',
    });
    /* Только на смену выбора: при перетаскивании и масштабировании
     * доска не должна прыгать сама. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlug]);

  const positionOf = useCallback(
    (node: BoardNode) => positions[node.id] ?? { x: node.x, y: node.y },
    [positions],
  );

  /** Узел под курсором, кроме самого перетаскиваемого: он под ним всегда.
   *  Выбранный узел нарисован поверх соседей, поэтому и проверяется последним. */
  const targetUnder = useCallback(
    (dragged: string, clientX: number, clientY: number) => {
      const boxes: NodeBox[] = [];
      let raised: NodeBox | null = null;
      for (const [id, element] of nodeRefs.current) {
        if (id === dragged) continue;
        const box = { id, rect: element.getBoundingClientRect() };
        if (id === selectedId) raised = box;
        else boxes.push(box);
      }
      if (raised) boxes.push(raised);
      return nodeAt(boxes, clientX, clientY);
    },
    [selectedId],
  );

  /** Ручное ребро этой пары, если оно уже есть. Направление не важно. */
  function manualLinkOf(a: string, b: string) {
    return (
      edges.find(
        (edge) =>
          edge.kind === 'manual' &&
          ((edge.from === a && edge.to === b) || (edge.from === b && edge.to === a)),
      ) ?? null
    );
  }

  function endNodeDrag() {
    setDrag(null);
    setDropTarget(null);
  }

  /** Жест прервали (системное меню, второй палец): координаты никуда не
   *  ушли, поэтому узел возвращается на место. */
  function cancelNodeDrag(id: string) {
    setPositions((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    endNodeDrag();
  }

  /** Указатель в процентах полотна. Узел ходит по всему полю, а не только
   *  по полотну: иначе на мелком масштабе видно поле, а поставить на него
   *  нечего. Пределы те же, что проверит сервер. */
  function toPercent(event: React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return clampBoardPoint({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  }

  function deselect() {
    if (selectedSlug) router.push('/board', { scroll: false });
  }

  /* Линия к цели, пока держим кнопку: без неё непонятно, что узел не просто
   * наехал на соседа, а сейчас с ним свяжется. */
  const draggedNode = drag ? byId.get(drag.id) : undefined;
  const targetNode = dropTarget ? byId.get(dropTarget) : undefined;
  const pendingLine =
    draggedNode && targetNode ? { a: positionOf(draggedNode), b: positionOf(targetNode) } : null;

  return (
    /* Окно доски высотой ровно в полотно на 100%: масштаб меняет размер канвы
     * внутри, но не самого окна — иначе он тянул бы за собой высоту страницы. */
    <div
      className={styles.viewport}
      style={{ '--board-viewport-height': `${BOARD_HEIGHT}px` } as React.CSSProperties}
    >
      {/* Кнопки масштаба лежат вне прокручиваемой области и вне канвы,
          поэтому изменение масштаба их не двигает. */}
      <div className={styles.viewControls}>
        <div className={styles.zoomControls}>
          <MonoLabel size={9} tone="faint" className={styles.zoomLabel}>
            Масштаб
          </MonoLabel>
          <button
            type="button"
            className={styles.zoomButton}
            aria-label="Уменьшить масштаб"
            disabled={zoomPercent <= ZOOM_MIN}
            onClick={() => zoomTo(zoomByButton(zoomPercent, -1))}
          >
            −
          </button>
          <button
            type="button"
            className={styles.zoomValue}
            title="Вернуть 100%"
            onClick={() => zoomTo(ZOOM_DEFAULT)}
          >
            {`${zoomPercent}%`}
          </button>
          <button
            type="button"
            className={styles.zoomButton}
            aria-label="Увеличить масштаб"
            disabled={zoomPercent >= ZOOM_MAX}
            onClick={() => zoomTo(zoomByButton(zoomPercent, 1))}
          >
            +
          </button>
        </div>

        {/* Масштаб увеличивает доску целиком, а это — только плитки: узлы
            стоят где стояли. Мелкие плитки разводят тесный граф, крупные
            читаются на мелком масштабе. */}
        <div className={styles.zoomControls}>
          <MonoLabel size={9} tone="faint" className={styles.zoomLabel}>
            Плитки
          </MonoLabel>
          <button
            type="button"
            className={styles.zoomButton}
            aria-label="Уменьшить плитки"
            disabled={tileStep === 0}
            onClick={() => tileScaleTo(Math.max(0, tileStep - 1))}
          >
            −
          </button>
          <button
            type="button"
            className={styles.zoomValue}
            title="Вернуть плитки 100%"
            onClick={() => tileScaleTo(TILE_SCALE_DEFAULT)}
          >
            {`${Math.round(tileScale * 100)}%`}
          </button>
          <button
            type="button"
            className={styles.zoomButton}
            aria-label="Увеличить плитки"
            disabled={tileStep === TILE_SCALE_STEPS.length - 1}
            onClick={() => tileScaleTo(Math.min(TILE_SCALE_STEPS.length - 1, tileStep + 1))}
          >
            +
          </button>
        </div>
      </div>

      <div className={styles.scroller} ref={scrollerRef}>
        {/* Распорка задаёт место под увеличенную канву вместе с полем вокруг:
            transform на размеры в потоке не влияет, без неё не появилось бы
            прокрутки. Фон живёт здесь же — иначе по краям масштабированной
            канвы виден просвет. */}
        <div
          className={pan?.movedFar ? `${styles.sizer} ${styles.panning}` : styles.sizer}
          style={{ width: FIELD_WIDTH * zoom, height: FIELD_HEIGHT * zoom }}
          onPointerDown={(event) => {
            /* Тянем за пустое место — двигаем доску. */
            if (event.button !== 0) return;
            const scroller = scrollerRef.current;
            if (!scroller) return;
            /* Захват указателя — удобство, а не условие: если браузер его
             * не даёт, панорамирование всё равно должно работать. */
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              /* пусто */
            }
            setPan({
              pointerId: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              left: scroller.scrollLeft,
              top: scroller.scrollTop,
              movedFar: false,
            });
          }}
          onPointerMove={(event) => {
            if (!pan || pan.pointerId !== event.pointerId) return;
            const scroller = scrollerRef.current;
            if (!scroller) return;

            const dx = event.clientX - pan.x;
            const dy = event.clientY - pan.y;
            if (!pan.movedFar && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
              setPan({ ...pan, movedFar: true });
            }
            scroller.scrollLeft = pan.left - dx;
            scroller.scrollTop = pan.top - dy;
          }}
          onPointerUp={(event) => {
            if (!pan || pan.pointerId !== event.pointerId) return;
            const wasPan = pan.movedFar;
            setPan(null);
            /* Клик по пустому месту — снять выделение. */
            if (!wasPan) deselect();
          }}
          onPointerCancel={() => setPan(null)}
        >
          <div
            className={styles.canvas}
            ref={canvasRef}
            style={{
              /* Посередине распорки. Пока поле больше окна, это ровно
                 BOARD_MARGIN × масштаб; на мелком масштабе распорка
                 тянется до края окна, и доска не липнет к углу. */
              left: `calc((100% - ${BOARD_WIDTH * zoom}px) / 2)`,
              top: `calc((100% - ${BOARD_HEIGHT * zoom}px) / 2)`,
              width: BOARD_WIDTH,
              height: BOARD_HEIGHT,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            <svg
              className={styles.lines}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {edges.map((edge) => {
                const from = byId.get(edge.from);
                const to = byId.get(edge.to);
                if (!from || !to) return null;
                const a = positionOf(from);
                const b = positionOf(to);
                /* Выведенное ребро тоньше и светлее ручного: оно не утверждение
                 * автора, а следствие того, что узлы названы в одной записи. */
                const derived = edge.kind === 'mention';
                return (
                  <line
                    key={edge.id}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="#a6825a"
                    strokeOpacity={derived ? 0.45 : 1}
                    strokeWidth={derived ? 0.6 : 0.8}
                    strokeDasharray={derived ? '1.5 2.5' : '3 2'}
                    vectorEffect="non-scaling-stroke"
                  >
                    <title>{derived ? 'Упомянуты в одной записи' : (edge.label ?? 'Связь')}</title>
                  </line>
                );
              })}

              {pendingLine ? (
                <line
                  x1={pendingLine.a.x}
                  y1={pendingLine.a.y}
                  x2={pendingLine.b.x}
                  y2={pendingLine.b.y}
                  stroke="var(--accent)"
                  strokeWidth={1.2}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
            </svg>

            {nodes.map((node) => {
              const position = positionOf(node);
              const selected = node.slug === selectedSlug;
              const size = sizeOf(node);
              const resizing = resize?.id === node.id ? resize : null;
              const wrapClassName = [
                styles.nodeWrap,
                resizing
                  ? styles.wrapResizing
                  : drag?.id === node.id
                    ? styles.wrapActive
                    : selected
                      ? styles.wrapSelected
                      : undefined,
              ]
                .filter(Boolean)
                .join(' ');
              const className = [
                styles.node,
                node.status === 'open' ? styles.open : undefined,
                node.status === 'resolved' ? styles.resolved : undefined,
                node.status === 'dead_end' ? styles.dead : undefined,
                selected ? styles.selected : undefined,
                drag?.id === node.id ? styles.dragging : undefined,
                dropTarget === node.id ? styles.dropTarget : undefined,
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <div
                  key={node.id}
                  className={wrapClassName}
                  style={
                    {
                      /* Пока тянут угол, плитка привязана к левому верхнему
                         углу: он и должен стоять, а размер растёт вправо-вниз. */
                      left: resizing ? `${resizing.grip.left}px` : `${position.x}%`,
                      top: resizing ? `${resizing.grip.top}px` : `${position.y}%`,
                      '--tile-scale': tileScale,
                    } as React.CSSProperties
                  }
                >
                  <button
                    type="button"
                    className={className}
                    style={{
                      width: size.width ?? undefined,
                      minHeight: size.height ?? undefined,
                    }}
                    aria-pressed={selected}
                    ref={(element) => {
                      if (element) nodeRefs.current.set(node.id, element);
                      else nodeRefs.current.delete(node.id);
                    }}
                    onPointerDown={(event) => {
                      /* Узел свой жест: доску за него не тянем. */
                      event.stopPropagation();
                      if (!canWrite) return;
                      try {
                        event.currentTarget.setPointerCapture(event.pointerId);
                      } catch {
                        /* пусто */
                      }
                      setDrag({ id: node.id, movedFar: false });
                    }}
                    onPointerMove={(event) => {
                      if (drag?.id !== node.id) return;
                      const next = toPercent(event);
                      if (!next) return;

                      const start = positionOf(node);
                      const far =
                        drag.movedFar ||
                        Math.abs(next.x - start.x) > 0.6 ||
                        Math.abs(next.y - start.y) > 0.6;

                      setDrag({ ...drag, movedFar: far });
                      setPositions((current) => ({ ...current, [node.id]: next }));
                      setDropTarget(
                        far ? targetUnder(node.id, event.clientX, event.clientY) : null,
                      );
                    }}
                    onPointerUp={(event) => {
                      event.stopPropagation();
                      /* Палец разводил масштаб — это конец щипка, а не тап. */
                      if (pinchedRef.current) return;
                      if (drag?.id !== node.id) {
                        router.push(`/board?node=${node.slug}`, { scroll: false });
                        return;
                      }
                      try {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      } catch {
                        /* пусто */
                      }
                      const moved = drag.movedFar;
                      /* Считаем цель заново: подсветка — состояние прошлого
                       * движения, а связывать нужно по месту отпускания. */
                      const target = moved
                        ? targetUnder(node.id, event.clientX, event.clientY)
                        : null;
                      endNodeDrag();

                      if (!moved) {
                        router.push(`/board?node=${node.slug}`, { scroll: false });
                        return;
                      }

                      /* Бросили на другой узел — это связь, а не переезд:
                       * узел возвращается на место, координаты не пишем. */
                      const to = target ? byId.get(target) : undefined;
                      if (to) {
                        setPositions((current) => {
                          const next = { ...current };
                          delete next[node.id];
                          return next;
                        });
                        const existing = manualLinkOf(node.id, to.id);
                        setLinking({
                          from: node,
                          to,
                          linkId: existing?.id ?? null,
                          label: existing?.label ?? null,
                        });
                        return;
                      }

                      const next = positions[node.id];
                      if (next) void saveNodePosition(node.id, next.x, next.y);
                    }}
                    onPointerCancel={() => cancelNodeDrag(node.id)}
                  >
                    {node.name}
                    <MonoLabel
                      size={9}
                      tracking="0.08em"
                      tone={selected ? 'onAccentDim' : node.status === 'open' ? 'accent' : 'faint'}
                      className={styles.kind}
                      block
                    >
                      {[NODE_KIND_LABEL[node.kind], node.status === 'dead_end' ? 'ТУПИК' : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </MonoLabel>
                  </button>

                  {/* Снять выделение, не уходя с доски. */}
                  {selected ? (
                    <button
                      type="button"
                      className={styles.deselect}
                      title="Снять выделение"
                      aria-label="Снять выделение"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        deselect();
                      }}
                    >
                      ×
                    </button>
                  ) : null}

                  {/* Нижний правый угол тянут, как у окна. Зона невидима, пока
                      над ней нет курсора, — иначе ручки на каждой плитке. */}
                  {canWrite ? (
                    <div
                      className={styles.resizeCorner}
                      title="Потяните, чтобы изменить размер"
                      aria-hidden="true"
                      onPointerDown={(event) => {
                        /* Угол — свой жест: ни перетаскивания узла, ни доски. */
                        event.stopPropagation();
                        if (event.button !== 0) return;
                        const canvas = canvasRef.current?.getBoundingClientRect();
                        const element = nodeRefs.current.get(node.id);
                        const drawn = drawnSize(node.id);
                        const pointer = toCanvas(event.clientX, event.clientY);
                        if (!canvas || !element || !drawn || !pointer) return;
                        try {
                          event.currentTarget.setPointerCapture(event.pointerId);
                        } catch {
                          /* пусто */
                        }
                        const rect = element.getBoundingClientRect();
                        setResize({
                          id: node.id,
                          pointerId: event.pointerId,
                          grip: gripOf(
                            {
                              left: ((rect.left - canvas.left) / canvas.width) * BOARD_WIDTH,
                              top: ((rect.top - canvas.top) / canvas.height) * BOARD_HEIGHT,
                              ...drawn,
                            },
                            pointer,
                            tileScale,
                          ),
                          moved: false,
                          before: { size, position },
                        });
                      }}
                      onPointerMove={(event) => {
                        if (resize?.id !== node.id || resize.pointerId !== event.pointerId) return;
                        const pointer = toCanvas(event.clientX, event.clientY);
                        if (!pointer) return;
                        const box = resizedBox(resize.grip, pointer);
                        if (!resize.moved) setResize({ ...resize, moved: true });
                        setSizes((current) => ({ ...current, [node.id]: box }));
                        /* Линии идут к центру. Размер — нарисованный, с прошлого
                         * кадра: содержимое может не пустить плитку уже и ниже. */
                        setPositions((current) => ({
                          ...current,
                          [node.id]: tileCenter(resize.grip, drawnSize(node.id) ?? box, BOARD),
                        }));
                      }}
                      onPointerUp={(event) => {
                        event.stopPropagation();
                        if (resize?.id !== node.id || resize.pointerId !== event.pointerId) return;
                        try {
                          event.currentTarget.releasePointerCapture(event.pointerId);
                        } catch {
                          /* пусто */
                        }
                        setResize(null);
                        const drawn = drawnSize(node.id);
                        if (
                          !resize.moved ||
                          !drawn ||
                          size.width === null ||
                          size.height === null
                        ) {
                          return;
                        }
                        /* Центр — по тому, что нарисовано сейчас: плитка вернётся
                         * к привязке по центру, и угол не должен дрогнуть. */
                        const center = tileCenter(resize.grip, drawn, BOARD);
                        setPositions((current) => ({ ...current, [node.id]: center }));
                        void saveNodeBox(node.id, {
                          ...center,
                          width: size.width,
                          height: size.height,
                        });
                      }}
                      onPointerCancel={() => {
                        if (resize?.id !== node.id) return;
                        /* Жест прервали — плитка возвращается как была. */
                        const { before } = resize;
                        setSizes((current) => ({ ...current, [node.id]: before.size }));
                        setPositions((current) => ({ ...current, [node.id]: before.position }));
                        setResize(null);
                      }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {linking ? (
        <LinkTypeDialog
          from={{ id: linking.from.id, name: linking.from.name }}
          to={{ id: linking.to.id, name: linking.to.name }}
          existingLinkId={linking.linkId}
          existingLabel={linking.label}
          labels={labels}
          onClose={() => setLinking(null)}
        />
      ) : null}
    </div>
  );
}
