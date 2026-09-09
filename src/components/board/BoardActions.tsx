'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createBoardNode, linkNodes } from '@/lib/actions/board';
import styles from './Board.module.css';

export function AddNodeButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={styles.addNode}
      disabled={pending}
      onClick={() => {
        const name = window.prompt('Название нового узла');
        if (!name?.trim()) return;
        startTransition(async () => {
          await createBoardNode(name);
          router.refresh();
        });
      }}
    >
      + УЗЕЛ
    </button>
  );
}

export function LinkNodeButton({
  fromNodeId,
  candidates,
}: {
  fromNodeId: string;
  candidates: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={styles.linkButton}
      disabled={pending}
      onClick={() => {
        const list = candidates.map((node, i) => `${i + 1}. ${node.name}`).join('\n');
        const pick = window.prompt(`С каким узлом связать?\n\n${list}\n\nНомер:`);
        const index = Number(pick) - 1;
        const target = candidates[index];
        if (!target) return;

        const label = window.prompt('Тип связи (ДОЛГ, ВРАЖДА, СЛЕД…)') ?? '';
        startTransition(async () => {
          await linkNodes(fromNodeId, target.id, label);
          router.refresh();
        });
      }}
    >
      СВЯЗАТЬ С УЗЛОМ…
    </button>
  );
}
