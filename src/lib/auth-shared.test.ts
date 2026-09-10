import { describe, expect, it } from 'vitest';
import { canEditEntry, type Viewer } from './auth-shared';

const player: Viewer = {
  id: 'u-player',
  name: 'Игрок',
  initial: 'И',
  role: 'player',
  characterSlug: 'geroy',
};
const other: Viewer = { ...player, id: 'u-other', name: 'Другой' };
const dm: Viewer = { ...player, id: 'u-dm', name: 'Мастер', role: 'dm' };

const entry = (visibility: 'public' | 'draft' | 'private' | 'dm_only') => ({
  authorId: player.id,
  visibility,
});

describe('canEditEntry', () => {
  it('гостю не даёт править ничего', () => {
    expect(canEditEntry(null, entry('public'))).toBe(false);
    expect(canEditEntry(null, entry('private'))).toBe(false);
  });

  it('общую запись правит любой вошедший, а не только автор', () => {
    expect(canEditEntry(player, entry('public'))).toBe(true);
    expect(canEditEntry(other, entry('public'))).toBe(true);
  });

  it('личную заметку правят только её автор и мастер', () => {
    expect(canEditEntry(player, entry('private'))).toBe(true);
    expect(canEditEntry(dm, entry('private'))).toBe(true);
    expect(canEditEntry(other, entry('private'))).toBe(false);
  });

  it('чужой черновик игроку недоступен — он его и не видит', () => {
    expect(canEditEntry(player, entry('draft'))).toBe(true);
    expect(canEditEntry(other, entry('draft'))).toBe(false);
  });

  it('скрытое от игроков остаётся за мастером', () => {
    expect(canEditEntry(dm, entry('dm_only'))).toBe(true);
    expect(canEditEntry(other, entry('dm_only'))).toBe(false);
  });

  it('запись без автора всё равно правится, если она общая', () => {
    expect(canEditEntry(other, { authorId: null, visibility: 'public' })).toBe(true);
    expect(canEditEntry(other, { authorId: null, visibility: 'private' })).toBe(false);
  });
});
