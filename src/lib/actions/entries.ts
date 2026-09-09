'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { desc, eq } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import { requireViewer } from './guard';
import { slugify } from '@/lib/slug';
import { syncEntryLinks } from '@/lib/wiki/sync-links';
import type { PickerNode } from '@/lib/queries/nodes';

export type NewEntry = {
  kind: t.EntryKind;
  title?: string;
  body: string;
  /** Для цитаты — чей это голос. */
  subjectId?: string;
  /** Для фото — подпись к кадру. */
  caption?: string;
  /** false — черновик: виден только автору (README «Быстрая запись»). */
  publish: boolean;
  /** Мастер может скрыть запись от игроков (README «Роли»). */
  dmOnly?: boolean;
};

export type CreateEntryResult =
  { ok: true; entryId: string; unresolved: string[] } | { ok: false; error: string };

export async function createEntry(input: NewEntry): Promise<CreateEntryResult> {
  const viewer = await requireViewer();
  const body = input.body.trim();
  const title = input.title?.trim() || null;

  if (input.kind === 'image') {
    if (!input.caption?.trim()) return { ok: false, error: 'Добавьте подпись к кадру' };
  } else if (!body) {
    return { ok: false, error: 'Запись не может быть пустой' };
  }

  const result = await runDb(async (db) => {
    /* Запись всегда привязывается к активной сессии — README «Быстрая запись». */
    const [session] = await db
      .select({ id: t.sessions.id })
      .from(t.sessions)
      .where(eq(t.sessions.campaignId, CAMPAIGN_ID))
      .orderBy(desc(t.sessions.number))
      .limit(1);

    const entryId = randomUUID();

    await db.insert(t.entries).values({
      id: entryId,
      campaignId: CAMPAIGN_ID,
      sessionId: session?.id ?? null,
      kind: input.kind,
      title,
      body: input.kind === 'image' ? null : body,
      authorId: viewer.id,
      subjectId: input.subjectId ?? null,
      visibility: !input.publish
        ? 'draft'
        : input.dmOnly && viewer.role === 'dm'
          ? 'dm_only'
          : 'public',
    });

    if (input.kind === 'image') {
      await db.insert(t.images).values({
        id: randomUUID(),
        campaignId: CAMPAIGN_ID,
        sessionId: session?.id ?? null,
        entryId,
        url: null, // из шита приходит только подпись; файл грузят на «Галерее»
        caption: input.caption?.trim() ?? null,
        uploaderId: viewer.id,
        kind: 'art',
      });
    }

    const sync = await syncEntryLinks(
      db,
      CAMPAIGN_ID,
      entryId,
      input.kind === 'image' ? null : body,
    );
    return { entryId, unresolved: sync.unresolved };
  });

  revalidatePath('/');
  return { ok: true, entryId: result.entryId, unresolved: result.unresolved };
}

/** Завести сущность по имени, которое осталось неразрешённым в уже сохранённой
 *  записи, и тут же пересчитать её связи — иначе ребро графа не появится
 *  никогда: пересчёт бывает только при сохранении. */
export async function resolveMention(
  entryId: string,
  name: string,
): Promise<{ ok: true; unresolved: string[] } | { ok: false; error: string }> {
  await requireViewer();
  if (!name.trim()) return { ok: false, error: 'Пустое имя сущности' };

  await createDraftNode(name);

  const unresolved = await runDb(async (db) => {
    const [entry] = await db
      .select({ body: t.entries.body })
      .from(t.entries)
      .where(eq(t.entries.id, entryId))
      .limit(1);
    if (!entry) return null;

    const sync = await syncEntryLinks(db, CAMPAIGN_ID, entryId, entry.body);
    return sync.unresolved;
  });

  if (unresolved === null) return { ok: false, error: 'Запись не найдена' };

  revalidatePath('/');
  revalidatePath('/board');
  return { ok: true, unresolved };
}

export type EntryPatch = {
  title?: string;
  body: string;
  caption?: string;
  subjectId?: string;
  publish: boolean;
  dmOnly?: boolean;
};

/** Править и удалять запись может её автор либо мастер. */
async function requireOwnership(entryId: string) {
  const viewer = await requireViewer();

  const entry = await runDb(async (db) => {
    const [row] = await db
      .select({ id: t.entries.id, kind: t.entries.kind, authorId: t.entries.authorId })
      .from(t.entries)
      .where(eq(t.entries.id, entryId))
      .limit(1);
    return row ?? null;
  });

  if (!entry) throw new Error('Запись не найдена');
  if (viewer.role !== 'dm' && entry.authorId !== viewer.id) {
    throw new Error('Эту запись писали не вы');
  }
  return { viewer, entry };
}

export async function updateEntry(entryId: string, input: EntryPatch): Promise<CreateEntryResult> {
  const { viewer, entry } = await requireOwnership(entryId);

  const body = input.body.trim();
  const title = input.title?.trim() || null;

  if (entry.kind === 'image') {
    if (!input.caption?.trim()) return { ok: false, error: 'Добавьте подпись к кадру' };
  } else if (!body) {
    return { ok: false, error: 'Запись не может быть пустой' };
  }

  const result = await runDb(async (db) => {
    await db
      .update(t.entries)
      .set({
        title,
        body: entry.kind === 'image' ? null : body,
        subjectId: input.subjectId ?? null,
        visibility: !input.publish
          ? 'draft'
          : input.dmOnly && viewer.role === 'dm'
            ? 'dm_only'
            : 'public',
      })
      .where(eq(t.entries.id, entryId));

    if (entry.kind === 'image' && input.caption) {
      await db
        .update(t.images)
        .set({ caption: input.caption.trim() })
        .where(eq(t.images.entryId, entryId));
    }

    /* Ради этого правка и нужна: рёбра приводятся в соответствие новому
     * тексту, и ссылка, убранная из записи, уносит за собой ребро графа. */
    const sync = await syncEntryLinks(
      db,
      CAMPAIGN_ID,
      entryId,
      entry.kind === 'image' ? null : body,
    );
    return sync.unresolved;
  });

  revalidatePath('/');
  revalidatePath('/board');
  revalidatePath('/kb');
  revalidatePath('/quotes');
  return { ok: true, entryId, unresolved: result };
}

export async function deleteEntry(
  entryId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { entry } = await requireOwnership(entryId);

  await runDb(async (db) => {
    /* Рёбра и голоса уходят каскадом по внешним ключам. Картинки,
     * приложенные к моменту, каскад только отвязывает — они остаются в
     * галерее. Исключение — запись типа «фото»: она сама и есть кадр. */
    if (entry.kind === 'image') {
      await db.delete(t.images).where(eq(t.images.entryId, entryId));
    }
    await db.delete(t.entries).where(eq(t.entries.id, entryId));
  });

  revalidatePath('/');
  revalidatePath('/board');
  revalidatePath('/kb');
  revalidatePath('/quotes');
  revalidatePath('/gallery');
  return { ok: true };
}

/** Опция «+ создать «…»» в автодополнении: черновая сущность типа
 *  «неизвестно», которую потом дополнят на странице сущности. */
export async function createDraftNode(rawName: string): Promise<PickerNode> {
  await requireViewer();
  const name = rawName.trim();
  if (!name) throw new Error('Пустое имя сущности');

  return runDb(async (db) => {
    const [existing] = await db
      .select({ id: t.nodes.id, name: t.nodes.name, slug: t.nodes.slug, kind: t.nodes.kind })
      .from(t.nodes)
      .where(eq(t.nodes.name, name))
      .limit(1);
    if (existing) return existing;

    /* Слаг должен быть уникален в кампании — при коллизии добавляем хвост. */
    const base = slugify(name) || 'node';
    const taken = await db
      .select({ slug: t.nodes.slug })
      .from(t.nodes)
      .where(eq(t.nodes.campaignId, CAMPAIGN_ID));
    const used = new Set(taken.map((row) => row.slug));
    let slug = base;
    let n = 2;
    while (used.has(slug)) slug = `${base}-${n++}`;

    const node = {
      id: randomUUID(),
      campaignId: CAMPAIGN_ID,
      kind: 'unknown' as const,
      name,
      slug,
      aliases: [],
    };
    await db.insert(t.nodes).values(node);

    /* Сразу кладём узел на доску: без координат он в граф не попадает,
     * а сущность, созданная из редактора, — полноценный участник графа.
     * Место у центра со сдвигом, чтобы новые узлы не ложились стопкой. */
    const placed = await db.select({ nodeId: t.boardPositions.nodeId }).from(t.boardPositions);
    const offset = (placed.length % 6) * 5;
    await db.insert(t.boardPositions).values({
      nodeId: node.id,
      x: 45 + offset,
      y: 45 + (placed.length % 3) * 6,
    });

    return { id: node.id, name: node.name, slug: node.slug, kind: node.kind };
  });
}
