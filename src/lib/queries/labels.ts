import { and, eq, isNotNull } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';

/** Типы связей, которые уже использовались в кампании — подсказки в форме,
 *  чтобы «ДОЛГ», «Долг» и «долг» не расползлись в три разных ярлыка. */
export function getLinkLabels(): Promise<string[]> {
  return runDb(async (db) => {
    const rows = await db
      .select({ label: t.links.label })
      .from(t.links)
      .where(and(eq(t.links.campaignId, CAMPAIGN_ID), isNotNull(t.links.label)));

    const unique = new Set(rows.map((row) => (row.label ?? '').trim()).filter(Boolean));
    return [...unique].sort((a, b) => a.localeCompare(b, 'ru'));
  });
}
