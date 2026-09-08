import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /* PGlite грузит wasm и держит состояние в процессе — бандлить его нельзя. */
  serverExternalPackages: ['@electric-sql/pglite'],
};

export default nextConfig;
