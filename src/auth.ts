/* Аутентификация: Auth.js с провайдером Credentials.
 *
 * Почему Credentials, а не OAuth: сайт закрыт для пяти человек, все учётки
 * заводит мастер, самостоятельной регистрации нет. Внешний провайдер добавил
 * бы зависимость и настройку приложения ради задачи, которую решает список
 * из пяти строк в базе. Discord-провайдер можно добавить рядом позже —
 * учётки не поменяются.
 *
 * Следствие выбора: Credentials работает только с JWT-сессиями (сессии в БД
 * Auth.js для него не поддерживает). Роль и слаг персонажа кладём в токен.
 */

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { verify } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import type { Role } from '@/lib/auth-shared';

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        name: { label: 'Кто вы' },
        password: { label: 'Пароль', type: 'password' },
      },
      async authorize(raw) {
        const name = typeof raw?.name === 'string' ? raw.name : '';
        const password = typeof raw?.password === 'string' ? raw.password : '';
        if (!name || !password) return null;

        const user = await runDb(async (db) => {
          const [row] = await db
            .select({
              id: t.users.id,
              name: t.users.name,
              initial: t.users.initial,
              role: t.users.role,
              passwordHash: t.users.passwordHash,
            })
            .from(t.users)
            .where(eq(t.users.name, name))
            .limit(1);
          if (!row?.passwordHash) return null;

          const [character] = await db
            .select({ slug: t.nodes.slug })
            .from(t.characters)
            .innerJoin(t.nodes, eq(t.nodes.id, t.characters.nodeId))
            .where(eq(t.characters.playerId, row.id))
            .limit(1);

          return { ...row, characterSlug: character?.slug ?? null };
        });

        if (!user) return null;
        if (!(await verify(user.passwordHash as string, password))) return null;

        return {
          id: user.id,
          name: user.name,
          initial: user.initial,
          role: user.role,
          characterSlug: user.characterSlug,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.initial = (user as { initial?: string }).initial ?? '?';
        token.role = (user as { role?: Role }).role ?? 'player';
        token.characterSlug = (user as { characterSlug?: string | null }).characterSlug ?? null;
      }
      return token;
    },
    session({ session, token }) {
      session.user = {
        ...session.user,
        id: String(token.uid ?? ''),
        name: session.user?.name ?? '',
        initial: String(token.initial ?? '?'),
        role: (token.role as Role) ?? 'player',
        characterSlug: (token.characterSlug as string | null) ?? null,
      };
      return session;
    },
  },
});
