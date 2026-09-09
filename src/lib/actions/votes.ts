'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { STUB_USER_ID } from '@/lib/campaign';

/** Один голос на пользователя на цитату — повторный клик снимает голос. */
export async function toggleVote(entryId: string): Promise<{ votes: number; mine: boolean }> {
  const result = await runDb(async (db) => {
    const existing = await db
      .select({ userId: t.votes.userId })
      .from(t.votes)
      .where(and(eq(t.votes.entryId, entryId), eq(t.votes.userId, STUB_USER_ID)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .delete(t.votes)
        .where(and(eq(t.votes.entryId, entryId), eq(t.votes.userId, STUB_USER_ID)));
    } else {
      await db.insert(t.votes).values({ entryId, userId: STUB_USER_ID });
    }

    const rows = await db
      .select({ userId: t.votes.userId })
      .from(t.votes)
      .where(eq(t.votes.entryId, entryId));

    return { votes: rows.length, mine: rows.some((row) => row.userId === STUB_USER_ID) };
  });

  revalidatePath('/quotes');
  revalidatePath('/');
  return result;
}
