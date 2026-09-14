/* Миграции, которые переносят данные, а не только меняют схему:
 * 0006 — кадр уезжает из portrait в свою колонку, 0011 — узел-персонаж
 * без строки в characters становится гостевым.
 *
 * Обычные тесты поднимают базу сразу со всеми миграциями и такой перенос
 * не видят — здесь мы останавливаемся перед ним, кладём строки в старой
 * форме и смотрим, во что они превратятся. Проверять это стоит: миграции
 * трогают боевые данные, а не пустые таблицы.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

const DRIZZLE = path.join(process.cwd(), 'drizzle');

/** Тег миграции, в которой кадр переехал. */
const MOVE_CROP = '0006_ambitious_sally_floyd';

type Journal = { entries: { idx: number; tag: string }[] };

async function tags(): Promise<string[]> {
  const journal: Journal = JSON.parse(
    await readFile(path.join(DRIZZLE, 'meta', '_journal.json'), 'utf8'),
  );
  return journal.entries.sort((a, b) => a.idx - b.idx).map((entry) => entry.tag);
}

async function apply(client: PGlite, tag: string) {
  const sql = await readFile(path.join(DRIZZLE, `${tag}.sql`), 'utf8');
  for (const statement of sql.split('--> statement-breakpoint')) {
    if (statement.trim()) await client.exec(statement);
  }
}

type Row = {
  node_id: string;
  portrait: string | null;
  portrait_crop_url: string | null;
  portrait_crop: { x: number } | null;
};

let rows: Record<string, Row>;

beforeAll(async () => {
  const client = await PGlite.create();
  const all = await tags();
  const upto = all.indexOf(MOVE_CROP);
  expect(upto).toBeGreaterThan(0);

  for (const tag of all.slice(0, upto)) await apply(client, tag);

  await client.exec(`
    INSERT INTO campaigns (id, title) VALUES ('c', 'Кампания');
    INSERT INTO nodes (id, campaign_id, kind, name, slug) VALUES
      ('n-cropped', 'c', 'character', 'Кадрированный', 'cropped'),
      ('n-plain', 'c', 'character', 'Просто портрет', 'plain'),
      ('n-legacy', 'c', 'character', 'До колонок', 'legacy'),
      ('n-empty', 'c', 'character', 'Без портрета', 'empty');
    INSERT INTO characters (node_id, portrait, portrait_source, portrait_crop) VALUES
      ('n-cropped', '/uploads/crop.png', '/uploads/orig.png', '{"x":0.1,"y":0.2,"w":0.5,"h":0.6}'),
      ('n-plain', '/uploads/plain.png', '/uploads/plain.png', NULL),
      ('n-legacy', '/uploads/legacy.png', NULL, NULL),
      ('n-empty', NULL, NULL, NULL);
  `);

  await apply(client, MOVE_CROP);

  const result = await client.query<Row>(
    'SELECT node_id, portrait, portrait_crop_url, portrait_crop FROM characters',
  );
  rows = Object.fromEntries(result.rows.map((row) => [row.node_id, row]));
  await client.close();
});

describe('0006: кадр переезжает в portrait_crop_url', () => {
  it('кадрированному возвращает оригинал в portrait, кадр уводит в свою колонку', () => {
    expect(rows['n-cropped']).toMatchObject({
      portrait: '/uploads/orig.png',
      portrait_crop_url: '/uploads/crop.png',
      portrait_crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.6 },
    });
  });

  it('некадрированный портрет остаётся на месте', () => {
    expect(rows['n-plain']).toMatchObject({
      portrait: '/uploads/plain.png',
      portrait_crop_url: null,
      portrait_crop: null,
    });
  });

  it('портрет из времён до колонок не теряется', () => {
    expect(rows['n-legacy']).toMatchObject({
      portrait: '/uploads/legacy.png',
      portrait_crop_url: null,
      portrait_crop: null,
    });
  });

  it('персонажа без портрета не трогает', () => {
    expect(rows['n-empty']).toMatchObject({
      portrait: null,
      portrait_crop_url: null,
      portrait_crop: null,
    });
  });
});

/** Тег миграции, после которой у каждого персонажа есть строка в characters. */
const GUESTS = '0011_guest_characters';

describe('0011: узел-персонаж без строки становится гостевым', () => {
  type Character = { node_id: string; is_pc: boolean };
  let characters: Record<string, Character>;
  let kinds: Record<string, string>;

  beforeAll(async () => {
    const client = await PGlite.create();
    const all = await tags();
    const upto = all.indexOf(GUESTS);
    expect(upto).toBeGreaterThan(0);

    for (const tag of all.slice(0, upto)) await apply(client, tag);

    await client.exec(`
      INSERT INTO campaigns (id, title) VALUES ('c', 'Кампания');
      INSERT INTO nodes (id, campaign_id, kind, name, slug) VALUES
        ('n-party', 'c', 'character', 'Из партии', 'party'),
        ('n-board', 'c', 'character', 'С доски', 'board'),
        ('n-npc', 'c', 'npc', 'NPC', 'npc'),
        ('n-odd', 'c', 'npc', 'Строка без типа', 'odd');
      INSERT INTO characters (node_id, is_pc) VALUES ('n-party', true), ('n-odd', true);
    `);

    await apply(client, GUESTS);

    const rows = await client.query<Character>('SELECT node_id, is_pc FROM characters');
    characters = Object.fromEntries(rows.rows.map((row) => [row.node_id, row]));
    const nodes = await client.query<{ id: string; kind: string }>('SELECT id, kind FROM nodes');
    kinds = Object.fromEntries(nodes.rows.map((row) => [row.id, row.kind]));
    await client.close();
  });

  it('персонажу с доски заводит строку гостя', () => {
    expect(characters['n-board']).toEqual({ node_id: 'n-board', is_pc: false });
  });

  it('персонажа партии не трогает', () => {
    expect(characters['n-party']).toEqual({ node_id: 'n-party', is_pc: true });
  });

  it('узлу другого типа строку не заводит', () => {
    expect(characters['n-npc']).toBeUndefined();
  });

  it('узлу со строкой возвращает тип «Персонаж»', () => {
    expect(kinds['n-odd']).toBe('character');
  });
});
