'use server';

import { AuthError } from 'next-auth';
import { hash, verify } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { signIn, signOut } from '@/auth';
import { runDb } from '@/lib/db/client';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth-shared';
import * as t from '@/lib/db/schema';
import { requireViewer } from './guard';

export type SignInResult = { ok: true } | { ok: false; error: string };

export async function signInWithPassword(formData: FormData): Promise<SignInResult> {
  try {
    await signIn('credentials', {
      name: formData.get('name'),
      password: formData.get('password'),
      redirect: false,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: 'Не тот пароль' };
    throw error;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: '/' });
}

export type ChangePasswordResult = { ok: true } | { ok: false; error: string };

/** Смена своего пароля. Мастер тут никого не меняет, кроме себя: чужой
 *  пароль сбрасывается скриптом `pnpm auth:password`, и это правильно —
 *  для сброса нужен доступ к базе, а не просто вход в чужую сессию. */
export async function changePassword(formData: FormData): Promise<ChangePasswordResult> {
  const viewer = await requireViewer();

  const current = String(formData.get('current') ?? '');
  const next = String(formData.get('next') ?? '');
  const again = String(formData.get('again') ?? '');

  if (next.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Новый пароль короче ${MIN_PASSWORD_LENGTH} символов` };
  }
  if (next !== again) return { ok: false, error: 'Новый пароль и подтверждение не совпали' };
  if (next === current) return { ok: false, error: 'Новый пароль совпадает со старым' };

  const changed = await runDb(async (db) => {
    const [row] = await db
      .select({ passwordHash: t.users.passwordHash })
      .from(t.users)
      .where(eq(t.users.id, viewer.id))
      .limit(1);

    if (!row?.passwordHash) return false;
    if (!(await verify(row.passwordHash, current))) return false;

    await db
      .update(t.users)
      .set({ passwordHash: await hash(next) })
      .where(eq(t.users.id, viewer.id));

    return true;
  });

  /* Сессия остаётся живой: в JWT пароля нет, менять токен не за чем. */
  if (!changed) return { ok: false, error: 'Текущий пароль не тот' };
  return { ok: true };
}
