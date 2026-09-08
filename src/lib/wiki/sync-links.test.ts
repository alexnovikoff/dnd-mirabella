import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '@/lib/db/test-db';
import type { Db } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { syncEntryLinks } from './sync-links';

const CAMPAIGN = 'c1';

let db: Db;

async function mentionsOf(entryId: string) {
  const rows = await db
    .select({ to: t.links.toNodeId })
    .from(t.links)
    .where(eq(t.links.fromEntryId, entryId));
  return rows.map((r) => r.to).sort();
}

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(t.campaigns).values({ id: CAMPAIGN, title: 'Тест', seal: 'Т' });
  await db.insert(t.nodes).values([
    {
      id: 'n-tavern',
      campaignId: CAMPAIGN,
      kind: 'location',
      name: 'Та Самая Таверна',
      slug: 'tavern',
      aliases: ['Таверна'],
    },
    {
      id: 'n-damaya',
      campaignId: CAMPAIGN,
      kind: 'npc',
      name: 'Дамайя',
      slug: 'damaya',
      aliases: [],
    },
    {
      id: 'n-tears',
      campaignId: CAMPAIGN,
      kind: 'artifact',
      name: 'Слёзы Мирабеллы',
      slug: 'tears',
      aliases: [],
    },
  ]);
  await db.insert(t.entries).values({
    id: 'e1',
    campaignId: CAMPAIGN,
    kind: 'moment',
    body: '',
  });
});

describe('syncEntryLinks', () => {
  it('создаёт ребро на каждую ссылку', async () => {
    const result = await syncEntryLinks(
      db,
      CAMPAIGN,
      'e1',
      'Были в [[Та Самая Таверна]] с [[Дамайя]]',
    );
    expect(result.added.sort()).toEqual(['n-damaya', 'n-tavern']);
    expect(await mentionsOf('e1')).toEqual(['n-damaya', 'n-tavern']);
  });

  it('удаляет ребро, когда ссылка исчезла из текста', async () => {
    await syncEntryLinks(db, CAMPAIGN, 'e1', '[[Та Самая Таверна]] и [[Дамайя]]');
    const result = await syncEntryLinks(
      db,
      CAMPAIGN,
      'e1',
      'Остались только в [[Та Самая Таверна]]',
    );

    expect(result.removed).toEqual(['n-damaya']);
    expect(await mentionsOf('e1')).toEqual(['n-tavern']);
  });

  it('на повторный вызов с тем же текстом ничего не меняет', async () => {
    await syncEntryLinks(db, CAMPAIGN, 'e1', '[[Дамайя]]');
    const result = await syncEntryLinks(db, CAMPAIGN, 'e1', '[[Дамайя]]');

    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(await mentionsOf('e1')).toEqual(['n-damaya']);
  });

  it('одна ссылка на сущность, даже если она упомянута дважды', async () => {
    await syncEntryLinks(db, CAMPAIGN, 'e1', '[[Дамайя]] и снова [[Дамайя]]');
    expect(await mentionsOf('e1')).toEqual(['n-damaya']);
  });

  it('находит сущность по алиасу и регистр не важен', async () => {
    await syncEntryLinks(db, CAMPAIGN, 'e1', 'зашли в [[таверна]]');
    expect(await mentionsOf('e1')).toEqual(['n-tavern']);
  });

  it('не создаёт сущность на незнакомое имя, но сообщает о нём', async () => {
    const result = await syncEntryLinks(db, CAMPAIGN, 'e1', 'про [[Неизвестный Кто-то]]');
    expect(result.unresolved).toEqual(['Неизвестный Кто-то']);
    expect(await mentionsOf('e1')).toEqual([]);
    const nodes = await db.select({ id: t.nodes.id }).from(t.nodes);
    expect(nodes).toHaveLength(3);
  });

  it('пустой текст снимает все рёбра', async () => {
    await syncEntryLinks(db, CAMPAIGN, 'e1', '[[Дамайя]] [[Слёзы Мирабеллы]]');
    await syncEntryLinks(db, CAMPAIGN, 'e1', '');
    expect(await mentionsOf('e1')).toEqual([]);
  });
});
