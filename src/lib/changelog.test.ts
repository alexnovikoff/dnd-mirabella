import { describe, expect, it } from 'vitest';
import pkg from '../../package.json';
import { CHANGE_VERB, CURRENT_RELEASE, RELEASES } from './changelog';

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

function parts(version: string): number[] {
  const match = SEMVER.exec(version);
  if (!match) throw new Error(`не semver: ${version}`);
  return match.slice(1).map(Number);
}

function compare(a: string, b: string): number {
  const [pa, pb] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

describe('changelog', () => {
  it('текущая версия совпадает с package.json', () => {
    expect(CURRENT_RELEASE.version).toBe(pkg.version);
  });

  it('версии идут от свежей к старой, без повторов', () => {
    for (let i = 1; i < RELEASES.length; i++) {
      expect(compare(RELEASES[i - 1].version, RELEASES[i].version)).toBeGreaterThan(0);
    }
  });

  it('даты — YYYY-MM-DD и не растут вниз по списку', () => {
    for (const release of RELEASES) {
      expect(release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    for (let i = 1; i < RELEASES.length; i++) {
      expect(RELEASES[i - 1].date >= RELEASES[i].date).toBe(true);
    }
  });

  const items = RELEASES.flatMap((release) => release.groups.flatMap((group) => group.items));

  it('каждый пункт начинается с того, что сделано: реализовано, добавлено, исправлено…', () => {
    for (const item of items) {
      expect(item).toMatch(CHANGE_VERB);
    }
  });

  it('в конце пункта нет точки', () => {
    for (const item of items) {
      expect(item).not.toMatch(/[.\s]$/);
    }
  });

  it('глагол узнаётся только целым словом', () => {
    expect('Изменена кнопка').toMatch(CHANGE_VERB);
    expect('Реализованы разделы').toMatch(CHANGE_VERB);
    expect('Исправлено: текст').toMatch(CHANGE_VERB);
    expect('Открытие сезона').not.toMatch(CHANGE_VERB);
    expect('Изменение масштаба').not.toMatch(CHANGE_VERB);
  });

  it('у каждой версии есть что показать', () => {
    for (const release of RELEASES) {
      expect(release.groups.length).toBeGreaterThan(0);
      for (const group of release.groups) {
        expect(group.items.length).toBeGreaterThan(0);
      }
    }
  });
});
