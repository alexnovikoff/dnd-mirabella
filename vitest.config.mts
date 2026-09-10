import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    /* Каждый файл с базой поднимает свой экземпляр pglite: на холодную это
     * WASM плюс миграции — работа с диском, а не счёт. На спокойной машине
     * укладывается и в дефолтные 10 с, но запаса они не оставляют, и под
     * нагрузкой прогон рассыпается. Падал не тест, а beforeEach
     * на createTestDb, поэтому запас нужен именно на хуках. */
    hookTimeout: 30000,
  },
  resolve: {
    alias: { '@': path.join(import.meta.dirname, 'src') },
  },
});
