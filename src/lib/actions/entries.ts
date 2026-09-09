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

export type CreateEntryResult = { ok: true; unresolved: string[] } | { ok: false; error: string };

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
        url: null, // загрузка файлов — этап 6
        caption: input.caption?.trim() ?? null,
        uploaderId: viewer.id,
        kind: 'art',
      });
    }

    return syncEntryLinks(db, CAMPAIGN_ID, entryId, input.kind === 'image' ? null : body);
  });

  revalidatePath('/');
  return { ok: true, unresolved: result.unresolved };
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

    return { id: node.id, name: node.name, slug: node.slug, kind: node.kind };
  });
}
