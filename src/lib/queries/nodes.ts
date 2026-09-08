import { asc, eq } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';

export type PickerNode = {
  id: string;
  name: string;
  slug: string;
  kind: t.NodeKind;
};

/** Все сущности кампании для автодополнения `[[`.
 *  Их десятки, а не тысячи, поэтому список отдаётся целиком и фильтруется
 *  на клиенте — без похода на сервер на каждое нажатие. */
export function getPickerNodes(): Promise<PickerNode[]> {
  return runDb((db) =>
    db
      .select({ id: t.nodes.id, name: t.nodes.name, slug: t.nodes.slug, kind: t.nodes.kind })
      .from(t.nodes)
      .where(eq(t.nodes.campaignId, CAMPAIGN_ID))
      .orderBy(asc(t.nodes.name)),
  );
}
