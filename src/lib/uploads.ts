/* Загрузка кадров по одному.
 *
 * Серверный экшен принимает тело не больше bodySizeLimit из next.config.ts,
 * а на Vercel запрос к функции и без того упирается в 4,5 МБ. Пачка кадров
 * одной формой этот потолок пробивала, и не доходил ни один. Поэтому каждый
 * файл едет своим запросом: отказ касается только его, остальные ложатся.
 *
 * Модуль без серверных импортов — его берут клиентские компоненты.
 */

/** Тот же предел стоит в next.config.ts — experimental.serverActions. */
export const UPLOAD_LIMIT_MB = 4;

/** Файлу нужно оставить в теле запроса место под разметку формы и поля
 *  вроде подписи и сессии — иначе впритык сервер его всё равно отвергнет. */
export const MAX_FILE_BYTES = UPLOAD_LIMIT_MB * 1024 * 1024 - 64 * 1024;

export type SendResult = { ok: true } | { ok: false; error: string };

export type UploadFailure = { file: File; error: string };

export type UploadOutcome = { saved: number; failed: UploadFailure[] };

export async function uploadEach(
  files: File[],
  send: (file: File) => Promise<SendResult>,
  onProgress?: (current: number, total: number) => void,
): Promise<UploadOutcome> {
  let saved = 0;
  const failed: UploadFailure[] = [];

  for (const [index, file] of files.entries()) {
    onProgress?.(index + 1, files.length);

    if (file.size > MAX_FILE_BYTES) {
      failed.push({ file, error: `Больше ${UPLOAD_LIMIT_MB} МБ: ${file.name}` });
      continue;
    }

    try {
      const result = await send(file);
      if (result.ok) saved += 1;
      else failed.push({ file, error: result.error });
    } catch {
      /* Упавший запрос — не ответ действия: в продакшене вместо текста
       * ошибки приходит только digest, показывать его незачем. */
      failed.push({ file, error: `Не удалось загрузить: ${file.name}` });
    }
  }

  return { saved, failed };
}

/** Отказы одной строкой — под полосой загрузки или в шите. */
export function describeFailures(failed: UploadFailure[]): string | null {
  return failed.length > 0 ? failed.map((item) => item.error).join(' · ') : null;
}
