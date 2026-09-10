'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import { requireViewer } from './guard';
import { canEditEntry } from '@/lib/auth-shared';
import { slugify } from '@/lib/slug';
import { syncEntryLinks } from '@/lib/wiki/sync-links';
import type { PickerNode } from '@/lib/queries/nodes';
import { findSessionMove, resolveSessionId } from '@/lib/queries/sessions';

export type NewEntry = {
  kind: t.EntryKind;
  title?: string;
  body: string;
  /** Для цитаты — чей это голос. */
  subjectId?: string;
  /** Для фото — подпись к кадру. */
  caption?: string;
  /** Сессия, выбранная в шите. Не задана — запись уйдёт в активную. */
  sessionId?: string;
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
    /* Запись цепляется к сессии, выбранной в шите; по умолчанию — активная. */
    const sessionId = await resolveSessionId(db, input.sessionId);

    const entryId = randomUUID();

    await db.insert(t.entries).values({
      id: entryId,
      campaignId: CAMPAIGN_ID,
      sessionId,
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
        sessionId,
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
  /** Сессия, выбранная в шите. Не задана — запись остаётся там, где была;
   *  NO_SESSION — её уносят из сессий вовсе. */
  sessionId?: string;
  publish: boolean;
  dmOnly?: boolean;
};

/** Есть ли у записи-фото загруженный кадр. Без него подпись — всё, что от
 *  записи остаётся, и стереть её значит стереть саму запись. */
function photoHasFile(entryId: string): Promise<boolean> {
  return runDb(async (db) => {
    const [row] = await db
      .select({ url: t.images.url })
      .from(t.images)
      .where(eq(t.images.entryId, entryId))
      .limit(1);
    return Boolean(row?.url);
  });
}

/** Право на правку считает canEditEntry: общую запись правит любой вошедший,
 *  личную заметку и чужой черновик — только автор либо мастер. */
async function requireOwnership(entryId: string) {
  const viewer = await requireViewer();

  const entry = await runDb(async (db) => {
    const [row] = await db
      .select({
        id: t.entries.id,
        kind: t.entries.kind,
        authorId: t.entries.authorId,
        visibility: t.entries.visibility,
      })
      .from(t.entries)
      .where(eq(t.entries.id, entryId))
      .limit(1);
    return row ?? null;
  });

  if (!entry) throw new Error('Запись не найдена');
  if (!canEditEntry(viewer, entry)) throw new Error('Эту запись писали не вы');
  return { viewer, entry };
}

export async function updateEntry(entryId: string, input: EntryPatch): Promise<CreateEntryResult> {
  const { viewer, entry } = await requireOwnership(entryId);

  const body = input.body.trim();
  const title = input.title?.trim() || null;
  const caption = input.caption?.trim() || null;

  if (entry.kind === 'image') {
    /* Подпись необязательна — но только пока кадр показывает себя сам. */
    if (!caption && !(await photoHasFile(entryId))) {
      return { ok: false, error: 'Приложите файл или добавьте подпись' };
    }
  } else if (!body) {
    return { ok: false, error: 'Запись не может быть пустой' };
  }

  const result = await runDb(async (db) => {
    /* Сессию трогаем, только если её выбрали: пустое значение означает
     * «оставить как было», а не «унести запись в активную». «Без сессии» —
     * такой же осознанный выбор, и его выполняем. */
    const move = await findSessionMove(db, input.sessionId);

    await db
      .update(t.entries)
      .set({
        /* Заголовок записи-фото — это её подпись: своего поля у неё нет. */
        title: entry.kind === 'image' ? caption : title,
        body: entry.kind === 'image' ? null : body,
        subjectId: input.subjectId ?? null,
        ...(move ? { sessionId: move.id } : {}),
        /* Личная заметка остаётся личной: кнопка «сохранить» не должна
         * втихую опубликовать то, что человек писал для себя. */
        visibility:
          entry.visibility === 'private'
            ? 'private'
            : !input.publish
              ? 'draft'
              : input.dmOnly && viewer.role === 'dm'
                ? 'dm_only'
                : 'public',
      })
      .where(eq(t.entries.id, entryId));

    if (entry.kind === 'image') {
      await db.update(t.images).set({ caption }).where(eq(t.images.entryId, entryId));
    }

    /* Кадры едут за записью: иначе фото осталось бы в галерее прошлой игры,
     * а сама запись уехала бы в другую. */
    if (move) {
      await db.update(t.images).set({ sessionId: move.id }).where(eq(t.images.entryId, entryId));
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
  revalidatePath('/sessions');
  revalidatePath('/gallery');
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
