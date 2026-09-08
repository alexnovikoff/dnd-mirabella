/* Соединение с локальной базой открывается один раз при старте сервера.
 * Если открывать его лениво в первом рендере, инициализация wasm у PGlite
 * падает с «ArrayBuffer is not detachable» и первый запрос отдаёт 500.
 * На Neon этот файл не понадобится — там подключение дешёвое и без wasm. */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { warmDb } = await import('@/lib/db/client');
  await warmDb();
}
