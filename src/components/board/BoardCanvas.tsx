'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MonoLabel } from '@/components/primitives';
import { saveNodePosition } from '@/lib/actions/board';
import { NODE_KIND_LABEL } from '@/lib/nodes';
import type { BoardEdge, BoardNode } from '@/lib/queries/board';
import styles from './Board.module.css';

/** Сдвиг больше этого — перетаскивание, меньше — клик по узлу. */
const DRAG_THRESHOLD = 3;

type Drag = {
  id: string;
  pointerId: number;
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
  const canvasRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  /* Локальные координаты на время перетаскивания — линии едут за узлом. */
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  const positionOf = useCallback(
    (node: BoardNode) => positions[node.id] ?? { x: node.x, y: node.y },
    [positions],
  );

  const byId = new Map(nodes.map((node) => [node.id, node]));

  function toPercent(event: React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.min(97, Math.max(3, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(97, Math.max(3, ((event.clientY - rect.top) / rect.height) * 100)),
    };
  }

  return (
    <div className={styles.canvas} ref={canvasRef}>
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
              stroke="#a6825a"
              strokeWidth={0.3}
              strokeDasharray="3 2"
              vectorEffect="non-scaling-stroke"
            />
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
          <button
            key={node.id}
            type="button"
            className={className}
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
            aria-pressed={selected}
            onPointerDown={(event) => {
              /* Захват указателя — оптимизация, чтобы курсор мог уйти за
               * пределы узла. Если браузер его не даёт, перетаскивание всё
               * равно должно работать. */
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                /* пусто */
              }
              setDrag({ id: node.id, pointerId: event.pointerId, movedFar: false });
            }}
            onPointerMove={(event) => {
              if (drag?.id !== node.id) return;
              const next = toPercent(event);
              if (!next) return;

              const start = positionOf(node);
              const far =
                drag.movedFar ||
                Math.abs(next.x - start.x) > DRAG_THRESHOLD / 5 ||
                Math.abs(next.y - start.y) > DRAG_THRESHOLD / 5;

              setDrag({ ...drag, movedFar: far });
              setPositions((current) => ({ ...current, [node.id]: next }));
            }}
            onPointerUp={(event) => {
              if (drag?.id !== node.id) return;
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
        );
      })}
    </div>
  );
}
