/* Свой пароль каждому участнику вместо общего пароля из сида.
 *
 *   pnpm auth:password Метель
 *
 * Пароль вводится в терминале и нигде не показывается: ни на экране, ни в
 * истории команд, ни в репозитории. В базу уходит только argon2-хеш — тот же,
 * что делает сид. Куда именно (Neon или локальный PGlite) решает DATABASE_URL,
 * как и везде.
 */

import { hash } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { openDb } from '../src/lib/db/open';
import * as t from '../src/lib/db/schema';

const MIN_LENGTH = 8;

/** Ввод без эха: терминал переводится в сырой режим и печатает точки. */
function askHidden(prompt: string): Promise<string> {
  const { stdin, stdout } = process;

  return new Promise((resolve, reject) => {
    if (!stdin.isTTY) {
      reject(new Error('Пароль нужно вводить в терминале, а не через пайп.'));
      return;
    }

    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';

    const stop = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      stdout.write('\n');
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        /* Enter — ввод закончен. */
        if (char === '\r' || char === '\n') {
          stop();
          resolve(value);
          return;
        }
        /* Ctrl+C — выйти, ничего не поменяв. */
        if (char === '\u0003') {
          stop();
          process.exit(130);
        }
        /* Backspace — стереть символ вместе с его точкой. */
        if (char === '\u007f' || char === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stdout.write('\b \b');
          }
          continue;
        }
        /* Прочие управляющие символы игнорируем. */
        if (char < ' ') continue;

        value += char;
        stdout.write('·');
      }
    };

    stdin.on('data', onData);
  });
}

async function main() {
  const wanted = process.argv[2]?.trim();
  const { db, where, close } = await openDb();

  const users = await db.select({ id: t.users.id, name: t.users.name }).from(t.users);
  const names = users.map((user) => user.name).join(', ');

  const fail = async (message: string) => {
    console.error(message);
    await close();
    process.exit(1);
  };

  if (!wanted) {
    await fail(
      `Кому меняем пароль? Например: pnpm auth:password Метель\nУчётки (${where}): ${names}`,
    );
    return;
  }

  const user = users.find((item) => item.name.toLowerCase() === wanted.toLowerCase());
  if (!user) {
    await fail(`Учётки «${wanted}» нет. Есть такие (${where}): ${names}`);
    return;
  }

  const password = await askHidden(`Новый пароль для «${user.name}»: `);
  if (password.length < MIN_LENGTH) {
    await fail(`Слишком короткий пароль: нужно хотя бы ${MIN_LENGTH} символов.`);
    return;
  }

  const again = await askHidden('Ещё раз: ');
  if (again !== password) {
    await fail('Пароли не совпали — ничего не меняю.');
    return;
  }

  await db
    .update(t.users)
    .set({ passwordHash: await hash(password) })
    .where(eq(t.users.id, user.id));

  console.log(`Пароль для «${user.name}» обновлён (${where}).`);
  await close();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
