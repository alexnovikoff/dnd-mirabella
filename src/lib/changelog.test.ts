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

  it('каждый пункт говорит, что сделано: добавлено, изменено, исправлено или убрано', () => {
    for (const release of RELEASES) {
      for (const group of release.groups) {
        for (const item of group.items) {
          expect(item).toMatch(CHANGE_VERB);
        }
      }
    }
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
