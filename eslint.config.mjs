import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default defineConfig([
  globalIgnores([
    '.next/**',
    '.vinext/**',
    '.sync-engine/**',
    '.wrangler/**',
    'build/**',
    'coverage/**',
    'dist/**',
    'node_modules/**',
    'out/**',
    'app/api/**',
    'public/sw.js',
    'sync/*.generated.ts',
    'worker-configuration.d.ts',
    'utils/engine.ts',
    '*.tsbuildinfo',
    'next-env.d.ts',
  ]),
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    name: 'annotation/project-overrides',
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
]);
