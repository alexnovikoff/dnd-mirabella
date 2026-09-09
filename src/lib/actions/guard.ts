import { getViewer } from '@/lib/viewer';
import type { Viewer } from '@/lib/auth-shared';

export class NotAuthorized extends Error {
  constructor() {
    super('Нужно войти');
    this.name = 'NotAuthorized';
  }
}

/** Любая запись требует входа: разлогиненный посетитель только читает. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new NotAuthorized();
  return viewer;
}
