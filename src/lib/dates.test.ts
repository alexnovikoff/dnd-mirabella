import { describe, expect, it } from 'vitest';
import { fullRuDate, numericDate, shortRuDate } from './dates';

describe('fullRuDate', () => {
  it('пишет дату игры целиком', () => {
    expect(fullRuDate('2025-09-06')).toBe('6 сентября 2025');
  });

  it('снимает ноль с числа и держит месяц в родительном падеже', () => {
    expect(fullRuDate('2026-01-01')).toBe('1 января 2026');
    expect(fullRuDate('2026-05-31')).toBe('31 мая 2026');
    expect(fullRuDate('2026-12-09')).toBe('9 декабря 2026');
  });

  it('без даты не выдумывает прочерк: подписи просто не будет', () => {
    expect(fullRuDate(null)).toBe('');
  });
});

describe('короткие формы', () => {
  it('остаются короткими: шапка и сайдбар живут в узкой колонке', () => {
    expect(shortRuDate('2025-09-06')).toBe('6 сент');
    expect(numericDate('2025-09-06')).toBe('06.09');
  });
});
