import { auth } from '@/auth';
import type { Viewer } from '@/lib/auth-shared';

/** Кто смотрит страницу. null — разлогинен: контент только для чтения. */
export async function getViewer(): Promise<Viewer | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    name: session.user.name,
    initial: session.user.initial,
    role: session.user.role,
    characterSlug: session.user.characterSlug,
  };
}
