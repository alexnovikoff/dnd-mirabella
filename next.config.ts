import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /* PGlite грузит wasm и держит состояние в процессе, argon2 — нативный
   * модуль: бандлить их нельзя, оба должны остаться внешними. */
  serverExternalPackages: ['@electric-sql/pglite', '@node-rs/argon2'],
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
