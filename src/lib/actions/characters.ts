'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { runDb, type Db } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import { isSupportedImage, removeUpload, saveUpload } from '@/lib/storage';
import { parseCrop } from '@/lib/crop';
import { requireViewer } from './guard';

export type PortraitResult = { ok: true } | { ok: false; error: string };

function revalidateCharacter() {
  revalidatePath('/');
  revalidatePath('/party');
  revalidatePath('/characters/[slug]', 'page');
}

/** Файлы портрета: сам портрет и вырезанный из него кадр для «Партии». */
type PortraitFiles = { portrait: string | null; portraitCropUrl: string | null };

async function readPortrait(db: Db, nodeId: string): Promise<PortraitFiles | undefined> {
  const [row] = await db
    .select({
      portrait: t.characters.portrait,
      portraitCropUrl: t.characters.portraitCropUrl,
    })
    .from(t.characters)
    .where(eq(t.characters.nodeId, nodeId))
    .limit(1);
  return row;
}

/** Убрать файлы, на которые после обновления никто не ссылается. */
async function removeUnused(previous: PortraitFiles, keep: (string | null)[]) {
  const alive = new Set(keep.filter((url): url is string => Boolean(url)));
  const gone = new Set(
    [previous.portrait, previous.portraitCropUrl].filter(
      (url): url is string => url !== null && !alive.has(url),
    ),
  );
  for (const url of gone) await removeUpload(url);
}

/** Портрет персонажа. Старые файлы убираются, чтобы в папке не копились
 *  сироты после каждой замены. Новая загрузка отменяет прошлый кадр:
 *  рамка была нарисована по другой картинке. */
export async function uploadPortrait(form: FormData): Promise<PortraitResult> {
  await requireViewer();

  const nodeId = String(form.get('nodeId') ?? '');
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Файл не выбран' };
  if (!isSupportedImage(file.type)) return { ok: false, error: `Не картинка: ${file.name}` };

  const url = await saveUpload(file);

  const previous = await runDb(async (db) => {
    const row = await readPortrait(db, nodeId);
    if (!row) return undefined;

    await db
      .update(t.characters)
      .set({ portrait: url, portraitCropUrl: null, portraitCrop: null })
      .where(eq(t.characters.nodeId, nodeId));
    return row;
  });

  if (previous === undefined) {
    await removeUpload(url);
    return { ok: false, error: 'Персонаж не найден' };
  }
  await removeUnused(previous, [url]);

  revalidateCharacter();
  return { ok: true };
}

/** Кадр для карточки в «Партии». Режет его браузер — сюда приходит готовый
 *  файл и рамка, по которой диалог откроется в следующий раз.
 *
 *  Портрет остаётся нетронутым: страница персонажа и аватары Хроники
 *  показывают его целиком, а кадрирование — дело одной карточки. Заодно
 *  каждое следующее кадрирование режет портрет, а не предыдущий кадр. */
export async function savePortraitCrop(form: FormData): Promise<PortraitResult> {
  await requireViewer();

  const nodeId = String(form.get('nodeId') ?? '');
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Кадр не получился' };
  if (!isSupportedImage(file.type)) return { ok: false, error: `Не картинка: ${file.name}` };

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(String(form.get('crop') ?? ''));
  } catch {
    /* Разбор рамки — ниже, одной проверкой на оба случая. */
  }
  const crop = parseCrop(parsed);
  if (!crop) return { ok: false, error: 'Рамка кадра не задана' };

  const url = await saveUpload(file);

  const previous = await runDb(async (db) => {
    const row = await readPortrait(db, nodeId);
    if (!row) return undefined;

    await db
      .update(t.characters)
      .set({ portraitCropUrl: url, portraitCrop: crop })
      .where(eq(t.characters.nodeId, nodeId));
    return row;
  });

  if (previous === undefined) {
    await removeUpload(url);
    return { ok: false, error: 'Персонаж не найден' };
  }
  await removeUnused(previous, [url, previous.portrait]);

  revalidateCharacter();
  return { ok: true };
}

export async function deletePortrait(nodeId: string): Promise<PortraitResult> {
  await requireViewer();

  const previous = await runDb(async (db) => {
    const row = await readPortrait(db, nodeId);
    if (!row) return undefined;

    await db
      .update(t.characters)
      .set({ portrait: null, portraitCropUrl: null, portraitCrop: null })
      .where(eq(t.characters.nodeId, nodeId));
    return row;
  });

  if (previous === undefined) return { ok: false, error: 'Персонаж не найден' };
  await removeUnused(previous, []);

  revalidateCharacter();
  return { ok: true };
}

export type NoteResult = { ok: true } | { ok: false; error: string };

/** Личная заметка о персонаже: видит только автор и мастер. */
export async function addPersonalNote(nodeId: string, body: string): Promise<NoteResult> {
  const viewer = await requireViewer();

  const text = body.trim();
  if (!text) return { ok: false, error: 'Заметка не может быть пустой' };

  await runDb(async (db) => {
    const [session] = await db
      .select({ id: t.sessions.id })
      .from(t.sessions)
      .where(eq(t.sessions.campaignId, CAMPAIGN_ID))
      .orderBy(t.sessions.number)
      .limit(1);

    await db.insert(t.entries).values({
      id: randomUUID(),
      campaignId: CAMPAIGN_ID,
      sessionId: session?.id ?? null,
      kind: 'note',
      title: null,
      body: text,
      authorId: viewer.id,
      subjectId: nodeId,
      visibility: 'private',
    });
  });

  revalidateCharacter();
  revalidatePath('/kb');
  return { ok: true };
}

/** Удаление личной заметки. Чужую убрать нельзя — кроме мастера. */
export async function deletePersonalNote(entryId: string): Promise<NoteResult> {
  const viewer = await requireViewer();

  const removed = await runDb(async (db) => {
    const [entry] = await db
      .select({ authorId: t.entries.authorId })
      .from(t.entries)
      .where(and(eq(t.entries.id, entryId), eq(t.entries.kind, 'note')))
      .limit(1);
    if (!entry) return false;
    if (viewer.role !== 'dm' && entry.authorId !== viewer.id) return false;

    await db.delete(t.entries).where(eq(t.entries.id, entryId));
    return true;
  });

  if (!removed) return { ok: false, error: 'Эту заметку писали не вы' };

  revalidateCharacter();
  revalidatePath('/kb');
  return { ok: true };
}
