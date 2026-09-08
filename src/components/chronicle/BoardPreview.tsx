import Link from 'next/link';
import { MonoLabel } from '@/components/primitives';
import { NODE_KIND_LABEL } from '@/lib/nodes';
import type { NodeKind, NodeStatus } from '@/lib/db/schema';
import styles from './BoardPreview.module.css';

type BoardNode = {
  id: string;
  name: string;
  slug: string;
  kind: NodeKind;
  status: NodeStatus | null;
  x: number;
  y: number;
};

export function BoardPreview({
  nodes,
  edges,
}: {
  nodes: BoardNode[];
  edges: { from: string; to: string }[];
}) {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>Доска связей</h2>
        <MonoLabel size={10} tracking="0.1em">
          Перетащите карточку, чтобы связать
        </MonoLabel>
      </div>

      <div className={styles.canvas}>
        {/* README: SVG в процентных координатах, штрих не масштабируется. */}
        <svg
          className={styles.lines}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {edges.map((edge, i) => {
            const from = byId.get(edge.from);
            const to = byId.get(edge.to);
            if (!from || !to) return null;
            return (
              <line
                key={i}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="var(--accent)"
                strokeWidth={0.35}
                strokeDasharray="3 2"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {nodes.map((node) => {
          const className = [
            styles.node,
            node.status === 'open' ? styles.nodeOpen : undefined,
            node.status === 'dead_end' ? styles.nodeDead : undefined,
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <Link
              key={node.id}
              href={`/entities/${node.slug}`}
              className={className}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
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
    </section>
  );
}
