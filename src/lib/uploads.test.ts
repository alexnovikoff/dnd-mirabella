import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, describeFailures, uploadEach, type SendResult } from './uploads';

function image(name: string, bytes = 10): File {
  return new File([new Uint8Array(bytes)], name, { type: 'image/png' });
}

describe('uploadEach', () => {
  it('отправляет каждый файл своим запросом и по порядку', async () => {
    const sent: string[] = [];
    const outcome = await uploadEach(
      [image('a.png'), image('b.png'), image('c.png')],
      async (file) => {
        sent.push(file.name);
        return { ok: true };
      },
    );

    expect(sent).toEqual(['a.png', 'b.png', 'c.png']);
    expect(outcome).toEqual({ saved: 3, failed: [] });
  });

  it('не бросает пачку из-за одного отказа', async () => {
    const b = image('b.png');
    const outcome = await uploadEach(
      [image('a.png'), b, image('c.png')],
      async (file): Promise<SendResult> =>
        file === b ? { ok: false, error: 'Не картинка: b.png' } : { ok: true },
    );

    expect(outcome.saved).toBe(2);
    expect(outcome.failed).toEqual([{ file: b, error: 'Не картинка: b.png' }]);
  });

  /* Так выглядит отказ сервера по размеру тела: действие не отвечает,
   * а падает — и без перехвата пачка молча пропадала целиком. */
  it('превращает упавший запрос в отказ по этому файлу', async () => {
    const a = image('a.png');
    const outcome = await uploadEach([a, image('b.png')], async (file) => {
      if (file === a) throw new Error('Body exceeded 1 MB limit.');
      return { ok: true };
    });

    expect(outcome.saved).toBe(1);
    expect(outcome.failed).toEqual([{ file: a, error: 'Не удалось загрузить: a.png' }]);
  });

  it('не отправляет файл, который сервер всё равно не примет по размеру', async () => {
    const big = image('big.png', MAX_FILE_BYTES + 1);
    const sent: string[] = [];
    const outcome = await uploadEach([big, image('ok.png')], async (file) => {
      sent.push(file.name);
      return { ok: true };
    });

    expect(sent).toEqual(['ok.png']);
    expect(outcome.failed).toEqual([{ file: big, error: 'Больше 4 МБ: big.png' }]);
  });

  it('сообщает, какой по счёту файл уходит', async () => {
    const progress: [number, number][] = [];
    await uploadEach(
      [image('a.png'), image('b.png')],
      async () => ({ ok: true }),
      (current, total) => progress.push([current, total]),
    );

    expect(progress).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });
});

describe('describeFailures', () => {
  it('молчит, когда всё загрузилось', () => {
    expect(describeFailures([])).toBeNull();
  });

  it('перечисляет все отказы одной строкой', () => {
    expect(
      describeFailures([
        { file: image('a.png'), error: 'Не картинка: a.png' },
        { file: image('b.png'), error: 'Больше 4 МБ: b.png' },
      ]),
    ).toBe('Не картинка: a.png · Больше 4 МБ: b.png');
  });
});
