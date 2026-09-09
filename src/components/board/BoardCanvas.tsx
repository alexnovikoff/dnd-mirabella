'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MonoLabel } from '@/components/primitives';
import { saveNodePosition } from '@/lib/actions/board';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { NODE_KIND_LABEL } from '@/lib/nodes';
import type { BoardEdge, BoardNode } from '@/lib/queries/board';
import styles from './Board.module.css';

/** Сдвиг больше этого — перетаскивание, меньше — клик. */
const DRAG_THRESHOLD = 4;

/* Масштаб доски. Координаты узлов хранятся в процентах, поэтому масштаб —
 * чисто визуальная штука: он ничего не пересчитывает и никуда не сохраняется. */
const ZOOM_STEPS = [0.6, 0.75, 0.9, 1, 1.25, 1.5, 2] as const;
const ZOOM_DEFAULT = ZOOM_STEPS.indexOf(1);

/* Собственный размер полотна: он не зависит от ширины колонки, поэтому
 * координаты узлов (проценты) всегда ложатся в одну и ту же систему, а
 * места хватает, чтобы двигать доску даже на 100%. В макете было 900×560,
 * но там доска и не двигалась. */
const BOARD_WIDTH = 1500;
const BOARD_HEIGHT = 900;

type NodeDrag = { id: string; movedFar: boolean };
type Pan = {
  pointerId: number;
  x: number;
  y: number;
  left: number;
  top: number;
  movedFar: boolean;
};

export function BoardCanvas({
  nodes,
  edges,
  selectedSlug,
}: {
  nodes: BoardNode[];
  edges: BoardEdge[];
  selectedSlug: string | null;
}) {
  const router = useRouter();
  const { canWrite } = useQuickEntry();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [zoomStep, setZoomStep] = useState<number>(ZOOM_DEFAULT);
  const [drag, setDrag] = useState<NodeDrag | null>(null);
  const [pan, setPan] = useState<Pan | null>(null);
  /* Локальные координаты на время перетаскивания — линии едут за узлом. */
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  const zoom = ZOOM_STEPS[zoomStep];
  const byId = new Map(nodes.map((node) => [node.id, node]));

  /* Полотно больше окна, поэтому выбранный узел может оказаться за краем —
   * например при переходе по связи из панели. Подкручиваем к нему. */
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !selectedSlug) return;

    const node = nodes.find((item) => item.slug === selectedSlug);
    if (!node) return;

    const position = positions[node.id] ?? { x: node.x, y: node.y };
    const target = {
      left: (BOARD_WIDTH * zoom * position.x) / 100 - scroller.clientWidth / 2,
      top: (BOARD_HEIGHT * zoom * position.y) / 100 - scroller.clientHeight / 2,
    };
    scroller.scrollTo({
      left: Math.max(0, target.left),
      top: Math.max(0, target.top),
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

  function toPercent(event: React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.min(97, Math.max(3, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(97, Math.max(3, ((event.clientY - rect.top) / rect.height) * 100)),
    };
  }

  function deselect() {
    if (selectedSlug) router.push('/board', { scroll: false });
  }

  return (
    <div className={styles.viewport}>
      {/* Кнопки масштаба лежат вне прокручиваемой области и вне канвы,
          поэтому изменение масштаба их не двигает. */}
      <div className={styles.zoomControls}>
        <button
          type="button"
          className={styles.zoomButton}
          aria-label="Уменьшить масштаб"
          disabled={zoomStep === 0}
          onClick={() => setZoomStep((step) => Math.max(0, step - 1))}
        >
          −
        </button>
        <button
          type="button"
          className={styles.zoomValue}
          title="Вернуть 100%"
          onClick={() => setZoomStep(ZOOM_DEFAULT)}
        >
          {`${Math.round(zoom * 100)}%`}
        </button>
        <button
          type="button"
          className={styles.zoomButton}
          aria-label="Увеличить масштаб"
          disabled={zoomStep === ZOOM_STEPS.length - 1}
          onClick={() => setZoomStep((step) => Math.min(ZOOM_STEPS.length - 1, step + 1))}
        >
          +
        </button>
      </div>

      <div className={styles.scroller} ref={scrollerRef}>
        {/* Распорка задаёт место под увеличенную канву: transform на размеры
            в потоке не влияет, без неё не появилось бы прокрутки. Фон живёт
            здесь же — иначе по краям масштабированной канвы виден просвет. */}
        <div
          className={pan?.movedFar ? `${styles.sizer} ${styles.panning}` : styles.sizer}
          style={{ width: BOARD_WIDTH * zoom, height: BOARD_HEIGHT * zoom }}
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
                    strokeWidth={derived ? 0.2 : 0.3}
                    strokeDasharray={derived ? '1.5 2.5' : '3 2'}
                    vectorEffect="non-scaling-stroke"
                  >
                    <title>{derived ? 'Упомянуты в одной записи' : (edge.label ?? 'Связь')}</title>
                  </line>
                );
              })}
            </svg>

            {nodes.map((node) => {
              const position = positionOf(node);
              const selected = node.slug === selectedSlug;
              const className = [
                styles.node,
                node.status === 'open' ? styles.open : undefined,
                node.status === 'resolved' ? styles.resolved : undefined,
                node.status === 'dead_end' ? styles.dead : undefined,
                selected ? styles.selected : undefined,
                drag?.id === node.id ? styles.dragging : undefined,
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <div
                  key={node.id}
                  className={styles.nodeWrap}
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                >
                  <button
                    type="button"
                    className={className}
                    aria-pressed={selected}
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
                      setDrag(null);

                      if (!moved) {
                        router.push(`/board?node=${node.slug}`, { scroll: false });
                        return;
                      }
                      const next = positions[node.id];
                      if (next) void saveNodePosition(node.id, next.x, next.y);
                    }}
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
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
