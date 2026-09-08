import type { NodeKind } from '@/lib/db/schema';

/** Подписи типов узлов — мета под названием на доске и в карточках. */
export const NODE_KIND_LABEL: Record<NodeKind, string> = {
  character: 'ПЕРСОНАЖ',
  npc: 'NPC',
  faction: 'ФРАКЦИЯ',
  location: 'ЛОКАЦИЯ',
  artifact: 'АРТЕФАКТ',
  event: 'СОБЫТИЕ',
  rumor: 'СЛУХ',
  unknown: 'НЕИЗВЕСТНО',
};
