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
  centerOf,
  clampBoardPoint,
  scrollToCenter,
} from '@/lib/board-view';
import { NODE_KIND_LABEL } from '@/lib/nodes';
import type { BoardEdge, BoardNode } from '@/lib/queries/board';
import styles from './Board.module.css';

/** Сдвиг больше этого — перетаскивание, меньше — клик. */
const DRAG_THRESHOLD = 4;

/* Масштаб доски. Координаты узлов хранятся в процентах, поэтому масштаб —
 * чисто визуальная штука: он ничего не пересчитывает и никуда не сохраняется. */
const ZOOM_STEPS = [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2] as const;
/* Доска открывается на 100% на любом экране, телефон тоже: имена узлов
 * читаются, а до остального графа доска дотягивается пальцем. */
const ZOOM_DEFAULT = ZOOM_STEPS.indexOf(1);

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

  const [zoomStep, setZoomStep] = useState<number>(ZOOM_DEFAULT);
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

  const zoom = ZOOM_STEPS[zoomStep];
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
  /* Точка поля, которую после смены масштаба надо вернуть в центр окна.
   * Первый показ — середина поля: запас для перетаскивания есть во все
   * стороны сразу. */
  const anchorRef = useRef<{ x: number; y: number } | null>({
    x: FIELD_WIDTH / 2,
    y: FIELD_HEIGHT / 2,
  });

  /* Масштаб меняет размер поля, а прокрутка остаётся в пикселях — без
   * поправки вид уезжал бы к углу. Центр снимаем до смены: после неё
   * прокрутку уже не прочесть — на меньшем поле браузер её обрезает. */
  function zoomTo(step: number) {
    if (ZOOM_STEPS[step] === zoomRef.current) return;
    const scroller = scrollerRef.current;
    if (scroller) {
      anchorRef.current = centerOf(
        { left: scroller.scrollLeft, top: scroller.scrollTop },
        zoomRef.current,
        viewportOf(scroller),
        FIELD,
      );
    }
    setZoomStep(step);
  }

  /* До отрисовки — иначе мелькнул бы пустой угол поля. */
  useLayoutEffect(() => {
    zoomRef.current = zoom;
    const scroller = scrollerRef.current;
    const anchor = anchorRef.current;
    if (!scroller || !anchor) return;
    anchorRef.current = null;

    const { left, top } = scrollToCenter(anchor, zoom, viewportOf(scroller), FIELD);
    scroller.scrollLeft = left;
    scroller.scrollTop = top;
  }, [zoom]);

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
            disabled={zoomStep === 0}
            onClick={() => zoomTo(Math.max(0, zoomStep - 1))}
          >
            −
          </button>
          <button
            type="button"
            className={styles.zoomValue}
            title="Вернуть 100%"
            onClick={() => zoomTo(ZOOM_DEFAULT)}
          >
            {`${Math.round(zoom * 100)}%`}
          </button>
          <button
            type="button"
            className={styles.zoomButton}
            aria-label="Увеличить масштаб"
            disabled={zoomStep === ZOOM_STEPS.length - 1}
            onClick={() => zoomTo(Math.min(ZOOM_STEPS.length - 1, zoomStep + 1))}
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
                    strokeWidth={derived ? 0.7 : 1}
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
