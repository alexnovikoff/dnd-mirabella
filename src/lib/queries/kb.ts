/* Запросы экрана «База знаний»: наводки со статусами, свободные заметки,
 * а также подтабы «Всё», NPC и Локации. */

import { and, desc, eq, isNotNull, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import type { Viewer } from '@/lib/auth-shared';
import { visibleEntries } from '@/lib/visibility';

export type KbTab = 'all' | 'notes' | 'npc' | 'locations';

/** Первый таб — тот, что открывается без query-параметра. */
export const KB_TABS: { id: KbTab; label: string }[] = [
  { id: 'all', label: 'ВСЁ' },
  { id: 'notes', label: 'ЗАМЕТКИ' },
  { id: 'npc', label: 'NPC' },
  { id: 'locations', label: 'ЛОКАЦИИ' },
];

export function isKbTab(value: string | undefined): value is KbTab {
  return KB_TABS.some((tab) => tab.id === value);
}

export type RumorCard = {
  id: string;
  name: string;
  slug: string;
  /** Тип узла — мета под названием карточки: NPC, ЛОКАЦИЯ и так далее. */
  kind: t.NodeKind;
  status: t.NodeStatus | null;
  /** Чипы связанных сущностей под карточкой; их число — счётчик связей. */
  related: RelatedNode[];
};

type RelatedNode = { id: string; name: string; slug: string };

export type FreeNote = {
  id: string;
  body: string | null;
  authorName: string | null;
  sessionNumber: number | null;
  isPrivate: boolean;
  /** Право на правку и поля шита: карточка заметки открывается в него. */
  authorId: string | null;
  sessionId: string | null;
  subjectId: string | null;
  visibility: t.Visibility;
};

/** Наводки: узлы со статусом, открытые первыми. */
export function getRumors(): Promise<RumorCard[]> {
  return getCards(isNotNull(t.nodes.status), [t.nodes.status, t.nodes.name]);
}

/** Свободные заметки. Личные видит автор, мастер — все. */
export function getFreeNotes(viewer: Viewer | null): Promise<FreeNote[]> {
  return runDb(async (db) => {
    const visible = visibleEntries(viewer);

    const rows = await db
      .select({
        id: t.entries.id,
        body: t.entries.body,
        visibility: t.entries.visibility,
        authorId: t.entries.authorId,
        sessionId: t.entries.sessionId,
        subjectId: t.entries.subjectId,
        authorName: t.users.name,
        sessionNumber: t.sessions.number,
      })
      .from(t.entries)
      .leftJoin(t.users, eq(t.users.id, t.entries.authorId))
      .leftJoin(t.sessions, eq(t.sessions.id, t.entries.sessionId))
      .where(and(eq(t.entries.campaignId, CAMPAIGN_ID), eq(t.entries.kind, 'note'), visible))
      .orderBy(desc(t.entries.createdAt), desc(t.entries.id));

    return rows.map((row) => ({ ...row, isPrivate: row.visibility === 'private' }));
  });
}

/** Карточки узлов: без аргумента — все узлы кампании, с типом — только узлы
 *  этого типа (подтабы NPC и Локации). */
export function getNodeCards(kind?: t.NodeKind): Promise<RumorCard[]> {
  return getCards(kind ? eq(t.nodes.kind, kind) : undefined, [t.nodes.name]);
}

/** Карточки с соседями по ручным рёбрам — у всех узлов, а не только у наводок.
 *
 *  Соседей раньше собирали одним наводкам, и в подтабах NPC и Локации, где
 *  карточки идут из общего списка узлов, чипов не было ни у кого. Счётчик
 *  связей — число этих соседей: он считал ещё и упоминания [[…]], и «5 связей»
 *  стояло рядом с одним чипом. По тем же ручным рёбрам считают «Связи · N»
 *  на карточке сущности и метрика связей персонажа. */
function getCards(where: SQL | undefined, order: (SQL | PgColumn)[]): Promise<RumorCard[]> {
  return runDb(async (db) => {
    const rows = await db
      .select({
        id: t.nodes.id,
        name: t.nodes.name,
        slug: t.nodes.slug,
        kind: t.nodes.kind,
        status: t.nodes.status,
      })
      .from(t.nodes)
      .where(and(eq(t.nodes.campaignId, CAMPAIGN_ID), where))
      .orderBy(...order);

    if (rows.length === 0) return [];

    const manual = await db
      .select({ from: t.links.fromNodeId, to: t.links.toNodeId })
      .from(t.links)
      .where(and(eq(t.links.campaignId, CAMPAIGN_ID), eq(t.links.kind, 'manual')));

    /* Соседи ищутся по всем узлам кампании: связь из NPC ведёт и в локацию,
     * которой в подтабе NPC нет. */
    const names = await db
      .select({ id: t.nodes.id, name: t.nodes.name, slug: t.nodes.slug })
      .from(t.nodes)
      .where(eq(t.nodes.campaignId, CAMPAIGN_ID));
    const byId = new Map(names.map((n) => [n.id, n]));

    return rows.map((row) => {
      /* Map по id: встречные рёбра A→B и B→A — один сосед, один чип. */
      const related = new Map<string, RelatedNode>();
      for (const link of manual) {
        const other = link.from === row.id ? link.to : link.to === row.id ? link.from : null;
        if (!other) continue;
        const node = byId.get(other);
        if (node) related.set(node.id, node);
      }
      return { ...row, related: [...related.values()] };
    });
  });
}

/** Объединение без повторов: узел со статусом попадает и в наводки, и в общий
 *  список узлов — в объединении он остаётся один раз, в порядке первой группы
 *  (наводки идут по статусу, остальные по имени). */
export function mergeKbCards(...groups: RumorCard[][]): RumorCard[] {
  const byId = new Map<string, RumorCard>();
  for (const group of groups) {
    for (const card of group) {
      if (!byId.has(card.id)) byId.set(card.id, card);
    }
  }
  return [...byId.values()];
}

/** Что показывает раздел базы знаний.
 *
 *  «Всё» собирается из всех узлов кампании, а не из перечня типов. Перечень
 *  («наводки, NPC и локации») терял узел любого другого типа без статуса —
 *  а «+ Добавить» на этой же странице и «+ УЗЕЛ» на доске заводят все восемь
 *  типов, и персонаж, фракция или артефакт пропадали из базы знаний совсем. */
export function kbCards(tab: KbTab, rumors: RumorCard[], nodes: RumorCard[]): RumorCard[] {
  if (tab === 'npc') return nodes.filter((card) => card.kind === 'npc');
  if (tab === 'locations') return nodes.filter((card) => card.kind === 'location');
  if (tab === 'all') return mergeKbCards(rumors, nodes);
  /* «Заметки» — свободные заметки и наводки, как в сайдбаре Хроники. */
  return rumors;
}
