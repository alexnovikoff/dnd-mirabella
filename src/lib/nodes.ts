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

/** Те же типы для выпадающих списков: капс уместен в мете под названием
 *  узла, но не в списке выбора. NPC — аббревиатура, остаётся как есть. */
export const NODE_KIND_TITLE: Record<NodeKind, string> = {
  character: 'Персонаж',
  npc: 'NPC',
  faction: 'Фракция',
  location: 'Локация',
  artifact: 'Артефакт',
  event: 'Событие',
  rumor: 'Слух',
  unknown: 'Неизвестно',
};
