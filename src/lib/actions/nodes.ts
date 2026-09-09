'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, ne } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import { slugify } from '@/lib/slug';
import { requireViewer } from './guard';

export type NodePatch = {
  name: string;
  kind: t.NodeKind;
  status: t.NodeStatus | null;
  description: string | null;
};

export type UpdateNodeResult =
  { ok: true; slug: string; renamedFrom: string | null } | { ok: false; error: string };

/** Уникальный слаг в пределах кампании. */
function pickSlug(base: string, taken: Set<string>): string {
  const root = slugify(base) || 'node';
  let slug = root;
  let n = 2;
  while (taken.has(slug)) slug = `${root}-${n++}`;
  return slug;
}

/**
 * Правка сущности. Переименование не рвёт старые записи: прежнее имя уходит
 * в алиасы, и `[[Старое Имя]]` в уже написанных текстах продолжает
 * резолвиться. Рёбра пересчитывать не нужно — они держатся на id узла.
 * Слаг переписывается под новое имя, поэтому старые ссылки вида
 * /entities/staryy-slug перестают работать; алиасы закрывают текст, не URL.
 */
export async function updateNode(nodeId: string, patch: NodePatch): Promise<UpdateNodeResult> {
  await requireViewer();

  const name = patch.name.trim();
  if (!name) return { ok: false, error: 'Название не может быть пустым' };

  return runDb(async (db) => {
    const [node] = await db
      .select()
      .from(t.nodes)
      .where(and(eq(t.nodes.id, nodeId), eq(t.nodes.campaignId, CAMPAIGN_ID)))
      .limit(1);
    if (!node) return { ok: false as const, error: 'Сущность не найдена' };

    const [character] = await db
      .select({ nodeId: t.characters.nodeId })
      .from(t.characters)
      .where(eq(t.characters.nodeId, nodeId))
      .limit(1);

    /* Персонаж партии остаётся персонажем: у него есть своя строка в
     * characters и своя страница, тип менять нельзя. */
    const kind = character ? 'character' : patch.kind;

    const others = await db
      .select({ id: t.nodes.id, name: t.nodes.name, slug: t.nodes.slug })
      .from(t.nodes)
      .where(and(eq(t.nodes.campaignId, CAMPAIGN_ID), ne(t.nodes.id, nodeId)));

    if (others.some((row) => row.name.toLowerCase() === name.toLowerCase())) {
      return { ok: false as const, error: 'Сущность с таким именем уже есть' };
    }

    const renamed = node.name !== name;
    const aliases = renamed
      ? [...new Set([...node.aliases, node.name])].filter(
          (alias) => alias.toLowerCase() !== name.toLowerCase(),
        )
      : node.aliases;

    const slug = renamed ? pickSlug(name, new Set(others.map((row) => row.slug))) : node.slug;

    await db
      .update(t.nodes)
      .set({
        name,
        kind,
        status: patch.status,
        description: patch.description?.trim() || null,
        aliases,
        slug,
      })
      .where(eq(t.nodes.id, nodeId));

    revalidatePath('/');
    revalidatePath('/board');
    revalidatePath('/kb');
    revalidatePath(`/entities/${slug}`);

    return { ok: true as const, slug, renamedFrom: renamed ? node.name : null };
  });
}

export type DeleteNodeResult = { ok: true } | { ok: false; error: string };

/**
 * Удаление сущности. Доступно любому вошедшему: сущности — общее хозяйство
 * кампании, их и заводят все.
 *
 * Рёбра и позиция на доске уходят каскадом. Текст записей не трогаем:
 * `[[Имя]]` останется и будет рисоваться серым — текст первичен, и решать,
 * переписывать ли его, автору записи.
 */
export async function deleteNode(nodeId: string): Promise<DeleteNodeResult> {
  await requireViewer();

  return runDb(async (db) => {
    const [character] = await db
      .select({ nodeId: t.characters.nodeId })
      .from(t.characters)
      .where(eq(t.characters.nodeId, nodeId))
      .limit(1);
    if (character) {
      return { ok: false as const, error: 'Персонажа партии удалить нельзя' };
    }

    await db
      .delete(t.nodes)
      .where(and(eq(t.nodes.id, nodeId), eq(t.nodes.campaignId, CAMPAIGN_ID)));

    revalidatePath('/');
    revalidatePath('/board');
    revalidatePath('/kb');
    return { ok: true as const };
  });
}
