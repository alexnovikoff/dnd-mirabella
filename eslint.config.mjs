import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  {
    // next-env.d.ts генерируется Next'ом и не проходит его же правило
    // про triple-slash reference.
    ignores: ['.next/**', 'node_modules/**', 'design_handoff_mirabella/**', 'next-env.d.ts'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];

export default config;
