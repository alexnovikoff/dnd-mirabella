import type { Role } from '@/lib/auth-shared';

declare module 'next-auth' {
  interface User {
    initial?: string;
    role?: Role;
    characterSlug?: string | null;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      initial: string;
      role: Role;
      characterSlug: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string;
    initial?: string;
    role?: Role;
    characterSlug?: string | null;
  }
}
