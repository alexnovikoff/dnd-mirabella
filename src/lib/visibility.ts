/* Кто какие записи видит. README «Аутентификация»:
 *  — игрок видит общее плюс свои личные заметки и свои черновики;
 *  — мастер видит и правит всё, включая скрытое от игроков (dm_only).
 * Разлогиненный видит только public — контент открыт для чтения. */

import { and, eq, or, type SQL } from 'drizzle-orm';
import * as t from '@/lib/db/schema';
import type { Viewer } from '@/lib/auth-shared';

export function visibleEntries(viewer: Viewer | null): SQL | undefined {
  if (viewer?.role === 'dm') return undefined; // мастер видит всё

  const own = viewer
    ? and(
        eq(t.entries.authorId, viewer.id),
        or(eq(t.entries.visibility, 'private'), eq(t.entries.visibility, 'draft')),
      )
    : undefined;

  return own ? or(eq(t.entries.visibility, 'public'), own) : eq(t.entries.visibility, 'public');
}
