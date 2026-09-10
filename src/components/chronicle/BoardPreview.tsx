'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { MonoLabel } from '@/components/primitives';
import { LinkTypeDialog } from '@/components/board/LinkTypeDialog';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import { nodeAt, type NodeBox } from '@/lib/board-drag';
import { NODE_KIND_LABEL } from '@/lib/nodes';
import type { NodeKind, NodeStatus } from '@/lib/db/schema';
import styles from './BoardPreview.module.css';

/** Сдвиг больше этого — перетаскивание, меньше — переход по ссылке. */
const DRAG_THRESHOLD = 4;

type BoardNode = {
  id: string;
  name: string;
  slug: string;
  kind: NodeKind;
  status: NodeStatus | null;
  x: number;
  y: number;
};

type BoardEdge = { id: string; from: string; to: string; label: string | null };

/** Карточка едет за курсором, но никуда не сохраняется: координаты общие
 *  с большой доской, а пропорции у превью свои — раскладку бы перекосило. */
type Drag = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  movedFar: boolean;
  point: { x: number; y: number } | null;
};

type Linking = { from: BoardNode; to: BoardNode; linkId: string | null; label: string | null };

export function BoardPreview({
  nodes,
  edges,
  labels,
}: {
  nodes: BoardNode[];
  edges: BoardEdge[];
  /** Уже использованные типы связи — подсказки в окне после дропа. */
  labels: string[];
}) {
  const { canWrite } = useQuickEntry();
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  /* Дроп заканчивается кликом по ссылке — его нужно съесть, иначе после
   * связывания страница уходит на сущность. */
  const swallowClick = useRef(false);

  const [drag, setDrag] = useState<Drag | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [linking, setLinking] = useState<Linking | null>(null);

  const byId = new Map(nodes.map((node) => [node.id, node]));

  const targetUnder = useCallback((dragged: string, clientX: number, clientY: number) => {
    const boxes: NodeBox[] = [];
    for (const [id, element] of nodeRefs.current) {
      if (id === dragged) continue;
      boxes.push({ id, rect: element.getBoundingClientRect() });
    }
    return nodeAt(boxes, clientX, clientY);
  }, []);

  function manualLinkOf(a: string, b: string) {
    return (
      edges.find(
        (edge) => (edge.from === a && edge.to === b) || (edge.from === b && edge.to === a),
      ) ?? null
    );
  }

  function toPercent(event: React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.min(97, Math.max(3, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(97, Math.max(3, ((event.clientY - rect.top) / rect.height) * 100)),
    };
  }

  function positionOf(node: BoardNode) {
    return drag?.id === node.id && drag.point ? drag.point : { x: node.x, y: node.y };
  }

  function endDrag() {
    setDrag(null);
    setDropTarget(null);
  }

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>Доска связей</h2>
        <div className={styles.headTools}>
          {canWrite ? (
            <MonoLabel size={10} tracking="0.1em">
              Перетащите карточку на карточку, чтобы связать
            </MonoLabel>
          ) : null}
          <Link href="/board">
            <MonoLabel size={10} tracking="0.1em" tone="accent">
              Открыть доску →
            </MonoLabel>
          </Link>
        </div>
      </div>

      <div className={styles.canvas} ref={canvasRef}>
        {/* README: SVG в процентных координатах, штрих не масштабируется. */}
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
            return (
              <line
                key={edge.id}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--accent)"
                strokeWidth={0.7}
                strokeDasharray="3 2"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {nodes.map((node) => {
          const position = positionOf(node);
          const className = [
            styles.node,
            canWrite ? styles.draggable : undefined,
            node.status === 'open' ? styles.nodeOpen : undefined,
            node.status === 'dead_end' ? styles.nodeDead : undefined,
            drag?.id === node.id && drag.movedFar ? styles.dragging : undefined,
            dropTarget === node.id ? styles.dropTarget : undefined,
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <Link
              key={node.id}
              href={`/entities/${node.slug}`}
              className={className}
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
              ref={(element) => {
                if (element) nodeRefs.current.set(node.id, element);
                else nodeRefs.current.delete(node.id);
              }}
              /* Нативное перетаскивание ссылки перебило бы наш жест. */
              draggable={false}
              onDragStart={(event) => event.preventDefault()}
              onClick={(event) => {
                if (!swallowClick.current) return;
                swallowClick.current = false;
                event.preventDefault();
              }}
              onPointerDown={(event) => {
                if (!canWrite || event.button !== 0) return;
                /* Флаг мог остаться от жеста, который кончился мимо карточки
                 * и клика не породил, — иначе он съел бы следующий переход. */
                swallowClick.current = false;
                try {
                  event.currentTarget.setPointerCapture(event.pointerId);
                } catch {
                  /* пусто */
                }
                setDrag({
                  id: node.id,
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                  movedFar: false,
                  point: null,
                });
              }}
              onPointerMove={(event) => {
                if (drag?.id !== node.id || drag.pointerId !== event.pointerId) return;
                const point = toPercent(event);
                if (!point) return;

                const far =
                  drag.movedFar ||
                  Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >
                    DRAG_THRESHOLD;

                setDrag({ ...drag, movedFar: far, point });
                setDropTarget(far ? targetUnder(node.id, event.clientX, event.clientY) : null);
              }}
              onPointerUp={(event) => {
                if (drag?.id !== node.id || drag.pointerId !== event.pointerId) return;
                const moved = drag.movedFar;
                const target = moved ? targetUnder(node.id, event.clientX, event.clientY) : null;
                endDrag();
                if (!moved) return;

                /* Тащили — значит переход по ссылке не нужен, чем бы дело
                   ни кончилось: и при связывании, и при промахе. */
                swallowClick.current = true;

                const to = target ? byId.get(target) : undefined;
                if (!to) return;
                const existing = manualLinkOf(node.id, to.id);
                setLinking({
                  from: node,
                  to,
                  linkId: existing?.id ?? null,
                  label: existing?.label ?? null,
                });
              }}
              onPointerCancel={() => endDrag()}
            >
              {node.name}
              <MonoLabel
                size={9}
                tracking="0.08em"
                tone={node.status === 'open' ? 'accent' : 'faint'}
                className={styles.kind}
                block
              >
                {NODE_KIND_LABEL[node.kind]}
              </MonoLabel>
            </Link>
          );
        })}
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
    </section>
  );
}
