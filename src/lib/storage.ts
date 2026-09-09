/* Хранилище загруженных файлов.
 *
 * Драйвер выбирается по BLOB_READ_WRITE_TOKEN: токен есть — Vercel Blob
 * (так работает продакшен, где файловая система только для чтения), токена
 * нет — локальный диск, public/uploads, который раздаёт сам Next.
 *
 * Наружу оба драйвера отдают одно и то же: URL, который уходит в images.url
 * и portrait. Локальный — относительный «/uploads/имя», Blob — абсолютный
 * «https://….public.blob.vercel-storage.com/uploads/имя»; по этому различию
 * removeUpload и понимает, чей файл удаляет.
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

/* Читаем лениво, а не на импорте модуля: в тестах и скриптах окружение
 * может появиться позже самого модуля. */
function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN || undefined;
}

export function isSupportedImage(type: string): boolean {
  return type in EXTENSIONS;
}

/** Сохраняет файл и возвращает URL, который уйдёт в images.url. */
export async function saveUpload(file: File): Promise<string> {
  const extension = EXTENSIONS[file.type];
  if (!extension) throw new Error(`Неподдерживаемый тип файла: ${file.type}`);

  const name = `${randomUUID()}.${extension}`;
  const token = blobToken();

  if (token) {
    const { put } = await import('@vercel/blob');
    /* Имя уже случайное — суффикс от Blob только испортил бы совпадение
     * URL с тем, что лежит в базе. */
    const { url } = await put(`uploads/${name}`, file, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: false,
      token,
    });
    return url;
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));

  return `/uploads/${name}`;
}

/** Убрать файл, на который больше никто не ссылается. Чужие и внешние
 *  адреса игнорируются: удаляем только то, что клали сами. */
export async function removeUpload(url: string | null): Promise<void> {
  if (!url) return;

  if (url.startsWith('https://')) {
    const token = blobToken();
    if (!token || !url.includes('.public.blob.vercel-storage.com/')) return;

    const { del } = await import('@vercel/blob');
    try {
      await del(url, { token });
    } catch {
      /* Файла уже нет — значит, задача выполнена. */
    }
    return;
  }

  if (!url.startsWith('/uploads/')) return;

  /* Путь собирается из basename, чтобы выход за пределы папки был невозможен. */
  const name = path.basename(url);
  if (!name || name === '.' || name === '..') return;

  try {
    await unlink(path.join(UPLOAD_DIR, name));
  } catch {
    /* Файла уже нет — значит, задача выполнена. */
  }
}
