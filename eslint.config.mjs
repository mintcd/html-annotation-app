import { defineConfig, globalIgnores } from 'eslint/config';
import next from '@next/eslint-plugin-next';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

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
  {
    name: 'annotation/react-and-vinext',
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      import: importPlugin,
      'jsx-a11y': jsxA11y,
      '@next/next': next,
    },
    languageOptions: {
      // Use the standalone parser so linting does not require the Next runtime.
      parser: tseslint.parser,
      parserOptions: {
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.browser, ...globals.node },
    },
    settings: {
      react: { version: 'detect' },
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.mts', '.cts', '.tsx', '.d.ts'],
      },
      'import/resolver': {
        node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
        typescript: { alwaysTryTypes: true },
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...next.configs['core-web-vitals'].rules,
      'import/no-anonymous-default-export': 'warn',
      'react/no-unknown-property': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'jsx-a11y/alt-text': ['warn', { elements: ['img'], img: ['Image'] }],
      'jsx-a11y/aria-props': 'warn',
      'jsx-a11y/aria-proptypes': 'warn',
      'jsx-a11y/aria-unsupported-elements': 'warn',
      'jsx-a11y/role-has-required-aria-props': 'warn',
      'jsx-a11y/role-supports-aria-props': 'warn',
      'react/jsx-no-target-blank': 'off',
    },
  },
  ...tseslint.configs.recommended,
  {
    name: 'annotation/typescript-overrides',
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
    },
  },
  {
    name: 'annotation/project-overrides',
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
]);
