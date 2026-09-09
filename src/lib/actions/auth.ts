'use server';

import { AuthError } from 'next-auth';
import { signIn, signOut } from '@/auth';

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
