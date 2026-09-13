import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /* PGlite грузит wasm и держит состояние в процессе, argon2 — нативный
   * модуль: бандлить их нельзя, оба должны остаться внешними. */
  serverExternalPackages: ['@electric-sql/pglite', '@node-rs/argon2'],
  experimental: {
    serverActions: {
      /* Кадры в «Галерею» и из шита едут серверными экшенами, по файлу
       * на запрос (lib/uploads). По умолчанию Next пускает в экшен 1 МБ —
       * меньше обычного фото. Выше 4 МБ поднимать некуда: запрос к функции
       * на Vercel ограничен 4,5 МБ. Число совпадает с UPLOAD_LIMIT_MB. */
      bodySizeLimit: '4mb',
    },
  },
  images: {
    /* Портреты и галерея в продакшене лежат в Vercel Blob — next/image
     * оптимизирует только явно разрешённые источники. */
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com',
        pathname: '/uploads/**',
      },
    ],
  },
};

export default nextConfig;
