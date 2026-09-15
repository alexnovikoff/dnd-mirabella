'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { runDb, type Db } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';
import { removeUpload } from '@/lib/storage';
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

/** Переименование: прежнее имя уходит в алиасы, слаг пересобирается.
 *  Общее для сущностей и персонажей. */
async function renameFields(
  db: Parameters<Parameters<typeof runDb>[0]>[0],
  node: { id: string; name: string; slug: string; aliases: string[] },
  name: string,
) {
  const others = await db
    .select({ id: t.nodes.id, name: t.nodes.name, slug: t.nodes.slug })
    .from(t.nodes)
    .where(and(eq(t.nodes.campaignId, CAMPAIGN_ID), ne(t.nodes.id, node.id)));

  if (others.some((row) => row.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false as const, error: 'Сущность с таким именем уже есть' };
  }

  const renamed = node.name !== name;
  return {
    ok: true as const,
    renamed,
    aliases: renamed
      ? [...new Set([...node.aliases, node.name])].filter(
          (alias) => alias.toLowerCase() !== name.toLowerCase(),
        )
      : node.aliases,
    slug: renamed ? pickSlug(name, new Set(others.map((row) => row.slug))) : node.slug,
  };
}

export type CharacterPatch = {
  name: string;
  race: string;
  classes: string;
  level: string;
  bio: string;
  sinceSession: string;
  /** Гостевой не виден в «Партии», hero «Хроники» и среди авторов цитат. */
  guest: boolean;
};

/** Правка карточки персонажа: имя узла, его игровые поля и признак гостя. */
export async function updateCharacter(
  nodeId: string,
  patch: CharacterPatch,
): Promise<UpdateNodeResult> {
  await requireViewer();

  const name = patch.name.trim();
  if (!name) return { ok: false, error: 'Имя не может быть пустым' };

  const toNumber = (value: string) => {
    const parsed = Number(value.trim());
    return value.trim() === '' || Number.isNaN(parsed) ? null : Math.trunc(parsed);
  };

  return runDb(async (db) => {
    const [node] = await db
      .select()
      .from(t.nodes)
      .where(and(eq(t.nodes.id, nodeId), eq(t.nodes.campaignId, CAMPAIGN_ID)))
      .limit(1);
    if (!node) return { ok: false as const, error: 'Персонаж не найден' };

    const rename = await renameFields(db, node, name);
    if (!rename.ok) return rename;

    await db
      .update(t.nodes)
      .set({ name, aliases: rename.aliases, slug: rename.slug })
      .where(eq(t.nodes.id, nodeId));

    await db
      .update(t.characters)
      .set({
        race: patch.race.trim() || null,
        classes: patch.classes.trim() || null,
        level: toNumber(patch.level),
        bio: patch.bio.trim() || null,
        sinceSession: toNumber(patch.sinceSession),
        isPc: !patch.guest,
      })
      .where(eq(t.characters.nodeId, nodeId));

    /* Весь layout, а не список страниц: имя и признак гостя видны и в авторах
     * цитат, а они живут в корневом layout — в шите быстрой записи. */
    revalidatePath('/', 'layout');

    return { ok: true as const, slug: rename.slug, renamedFrom: rename.renamed ? node.name : null };
  });
}

/** Строка персонажа узла: есть ли она и привязан ли к ней игрок. */
async function readCharacter(db: Db, nodeId: string) {
  const [row] = await db
    .select({
      playerId: t.characters.playerId,
      portrait: t.characters.portrait,
      portraitCropUrl: t.characters.portraitCropUrl,
    })
    .from(t.characters)
    .where(eq(t.characters.nodeId, nodeId))
    .limit(1);
  return row;
}

/** Файлы, которые живут только ради узла: кадры, привязанные к нему
 *  (достижения или кадры карточки), и портрет с кадром для «Партии». */
async function nodeFiles(
  db: Db,
  nodeId: string,
  kinds: t.NodeImageKind[],
  character: { portrait: string | null; portraitCropUrl: string | null } | undefined,
): Promise<string[]> {
  const images = await db
    .select({ url: t.images.url })
    .from(t.images)
    .where(and(eq(t.images.nodeId, nodeId), inArray(t.images.kind, kinds)));
  return [
    ...images.map((image) => image.url),
    character?.portrait ?? null,
    character?.portraitCropUrl ?? null,
  ].filter((url): url is string => Boolean(url));
}

function revalidateNode() {
  revalidatePath('/');
  revalidatePath('/board');
  revalidatePath('/kb');
  revalidatePath('/party');
  revalidatePath('/entities/[slug]', 'page');
  revalidatePath('/characters/[slug]', 'page');
}

/**
 * Правка сущности. Переименование не рвёт старые записи: прежнее имя уходит
 * в алиасы, и `[[Старое Имя]]` в уже написанных текстах продолжает
 * резолвиться. Рёбра пересчитывать не нужно — они держатся на id узла.
 * Слаг переписывается под новое имя, поэтому старые ссылки вида
 * /entities/staryy-slug перестают работать; алиасы закрывают текст, не URL.
 *
 * Персонаж — один тип: узел «Персонаж» всегда со строкой в characters.
 * Смена типа на «Персонаж» заводит строку гостевого персонажа; смена с
 * «Персонажа» на другой тип строку убирает — вместе с портретом,
 * биографией и достижениями. Персонажу, к которому привязан игрок, тип
 * не меняется: у игрока своя учётка и своя страница.
 */
export async function updateNode(nodeId: string, patch: NodePatch): Promise<UpdateNodeResult> {
  await requireViewer();

  const name = patch.name.trim();
  if (!name) return { ok: false, error: 'Название не может быть пустым' };

  const result = await runDb(async (db) => {
    const [node] = await db
      .select()
      .from(t.nodes)
      .where(and(eq(t.nodes.id, nodeId), eq(t.nodes.campaignId, CAMPAIGN_ID)))
      .limit(1);
    if (!node) return { ok: false as const, error: 'Сущность не найдена' };

    const character = await readCharacter(db, nodeId);
    const kind = character?.playerId ? 'character' : patch.kind;

    const rename = await renameFields(db, node, name);
    if (!rename.ok) return rename;

    await db
      .update(t.nodes)
      .set({
        name,
        kind,
        status: patch.status,
        description: patch.description?.trim() || null,
        aliases: rename.aliases,
        slug: rename.slug,
      })
      .where(eq(t.nodes.id, nodeId));

    let orphans: string[] = [];
    if (kind === 'character' && !character) {
      await db.insert(t.characters).values({ nodeId, isPc: false });
    } else if (kind !== 'character' && character) {
      orphans = await nodeFiles(db, nodeId, ['achievement'], character);
      await db
        .delete(t.images)
        .where(and(eq(t.images.nodeId, nodeId), eq(t.images.kind, 'achievement')));
      await db.delete(t.characters).where(eq(t.characters.nodeId, nodeId));
    }

    return {
      ok: true as const,
      slug: rename.slug,
      renamedFrom: rename.renamed ? node.name : null,
      orphans,
    };
  });

  if (!result.ok) return result;
  for (const url of result.orphans) await removeUpload(url);

  revalidateNode();
  return { ok: true, slug: result.slug, renamedFrom: result.renamedFrom };
}

export type DeleteNodeResult = { ok: true } | { ok: false; error: string };

/**
 * Удаление сущности. Доступно любому вошедшему: сущности — общее хозяйство
 * кампании, их и заводят все. Гостевого персонажа и персонажа без игрока
 * удалить можно; персонажа, к которому привязан игрок, — нет.
 *
 * Рёбра, позиция на доске, строка персонажа и привязанные кадры уходят
 * каскадом, файлы кадров и портрета — следом из хранилища. Текст записей
 * не трогаем: `[[Имя]]` останется и будет рисоваться серым — текст
 * первичен, и решать, переписывать ли его, автору записи.
 */
export async function deleteNode(nodeId: string): Promise<DeleteNodeResult> {
  await requireViewer();

  const result = await runDb(async (db) => {
    const character = await readCharacter(db, nodeId);
    if (character?.playerId) {
      return { ok: false as const, error: 'Персонажа игрока удалить нельзя' };
    }

    const orphans = await nodeFiles(db, nodeId, t.NODE_IMAGE_KINDS, character);
    await db
      .delete(t.nodes)
      .where(and(eq(t.nodes.id, nodeId), eq(t.nodes.campaignId, CAMPAIGN_ID)));
    return { ok: true as const, orphans };
  });

  if (!result.ok) return result;
  for (const url of result.orphans) await removeUpload(url);

  revalidateNode();
  return { ok: true };
}
