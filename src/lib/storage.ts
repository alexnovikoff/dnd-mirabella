/* Хранилище загруженных файлов.
 *
 * Пока это локальный диск: файлы кладутся в public/uploads и раздаются
 * Next'ом как статика. На Vercel файловая система только для чтения —
 * там этот модуль заменит драйвер Vercel Blob (put из @vercel/blob),
 * а вызывающий код и колонка images.url останутся прежними.
 */

import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export function isSupportedImage(type: string): boolean {
  return type in EXTENSIONS;
}

/** Сохраняет файл и возвращает URL, который уйдёт в images.url. */
export async function saveUpload(file: File): Promise<string> {
  const extension = EXTENSIONS[file.type];
  if (!extension) throw new Error(`Неподдерживаемый тип файла: ${file.type}`);

  await mkdir(UPLOAD_DIR, { recursive: true });

  const name = `${randomUUID()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, name), bytes);

  return `/uploads/${name}`;
}

/** Убрать файл, на который больше никто не ссылается. Работает только со
 *  своими URL вида /uploads/<имя>: путь собирается из basename, чтобы
 *  выход за пределы папки был невозможен. У драйвера Blob здесь будет del(). */
export async function removeUpload(url: string | null): Promise<void> {
  if (!url?.startsWith('/uploads/')) return;

  const name = path.basename(url);
  if (!name || name === '.' || name === '..') return;

  try {
    await unlink(path.join(UPLOAD_DIR, name));
  } catch {
    /* Файла уже нет — значит, задача выполнена. */
  }
}
