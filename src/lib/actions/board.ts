'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import { slugify } from '@/lib/slug';
import { requireViewer } from './guard';

/** Позиция в процентах — доска общая на кампанию (решение в docs/plan.md). */
export async function saveNodePosition(nodeId: string, x: number, y: number) {
  await requireViewer();
  const clamp = (value: number) => Math.min(97, Math.max(3, Math.round(value)));

  await runDb(async (db) => {
    const existing = await db
      .select({ nodeId: t.boardPositions.nodeId })
      .from(t.boardPositions)
      .where(eq(t.boardPositions.nodeId, nodeId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(t.boardPositions)
        .set({ x: clamp(x), y: clamp(y) })
        .where(eq(t.boardPositions.nodeId, nodeId));
    } else {
      await db.insert(t.boardPositions).values({ nodeId, x: clamp(x), y: clamp(y) });
    }
  });

  revalidatePath('/board');
}

/** Кнопка «+ УЗЕЛ» на тулбаре доски и «+ Добавить» в базе знаний. Тип
 *  выбирается сразу — иначе узлы копятся с типом «неизвестно», а исправить
 *  его в интерфейсе нечем. */
export async function createBoardNode(name: string, kind: t.NodeKind = 'unknown') {
  await requireViewer();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, error: 'Пустое имя узла' };

  await runDb(async (db) => {
    const taken = await db
      .select({ slug: t.nodes.slug })
      .from(t.nodes)
      .where(eq(t.nodes.campaignId, CAMPAIGN_ID));
    const used = new Set(taken.map((row) => row.slug));

    const base = slugify(trimmed) || 'node';
    let slug = base;
    let n = 2;
    while (used.has(slug)) slug = `${base}-${n++}`;

    const id = randomUUID();
    await db.insert(t.nodes).values({
      id,
      campaignId: CAMPAIGN_ID,
      kind,
      name: trimmed,
      slug,
      aliases: [],
    });
    /* Новый узел появляется в центре — дальше его перетащат. */
    await db.insert(t.boardPositions).values({ nodeId: id, x: 50, y: 50 });
  });

  revalidatePath('/board');
  revalidatePath('/kb');
  revalidatePath('/entities/[slug]', 'page');
  return { ok: true as const };
}

/** Сменить тип уже существующей связи. */
export async function updateLink(linkId: string, label: string) {
  await requireViewer();

  await runDb(async (db) => {
    await db
      .update(t.links)
      .set({ label: label.trim() || null })
      .where(and(eq(t.links.id, linkId), eq(t.links.kind, 'manual')));
  });

  revalidatePath('/board');
  revalidatePath('/kb');
  revalidatePath('/entities/[slug]', 'page');
  return { ok: true as const };
}

/** Убрать ручную связь. Рёбра-упоминания так не удаляются: они выводятся
 *  из текста, и убрать их можно только правкой самой записи. */
export async function deleteLink(linkId: string) {
  await requireViewer();

  await runDb(async (db) => {
    await db.delete(t.links).where(and(eq(t.links.id, linkId), eq(t.links.kind, 'manual')));
  });

  revalidatePath('/board');
  revalidatePath('/kb');
  revalidatePath('/entities/[slug]', 'page');
  return { ok: true as const };
}

/** «СВЯЗАТЬ С УЗЛОМ»: ручное ребро с типом отношения. */
export async function linkNodes(fromNodeId: string, toNodeId: string, label: string) {
  await requireViewer();
  if (fromNodeId === toNodeId) return { ok: false as const, error: 'Узел нельзя связать с собой' };

  await runDb(async (db) => {
    const existing = await db
      .select({ id: t.links.id })
      .from(t.links)
      .where(
        and(
          eq(t.links.kind, 'manual'),
          eq(t.links.fromNodeId, fromNodeId),
          eq(t.links.toNodeId, toNodeId),
        ),
      )
      .limit(1);
    if (existing.length > 0) return;

    await db.insert(t.links).values({
      id: randomUUID(),
      campaignId: CAMPAIGN_ID,
      kind: 'manual',
      fromNodeId,
      fromEntryId: null,
      toNodeId,
      label: label.trim() || null,
    });
  });

  revalidatePath('/board');
  revalidatePath('/entities/[slug]', 'page');
  return { ok: true as const };
}
