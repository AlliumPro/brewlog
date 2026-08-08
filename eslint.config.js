import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'apps/web/src/shared/api/generated.ts',
    ],
  },

  js.configs.recommended,

  // Type-aware linting for application code only. Root tooling configs live outside the
  // app tsconfigs, so they are linted without type information below.
  {
    files: ['apps/**/*.{ts,tsx}'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        project: [
          './apps/api/tsconfig.json',
          './apps/web/tsconfig.json',
          './apps/web/tsconfig.node.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      // A leading underscore marks a binding that exists only to be discarded — the usual
      // shape of "destructure everything except these keys".
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      // explicit-function-return-type is deliberately off: Fastify and RTK Query infer precise
      // types through generics, and restating them by hand loses information rather than adding it.
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // Backend runs in Node.
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // Frontend runs in the browser. Node globals must not leak into it.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },

  // Build-time config files inside the workspaces run in Node, not in the browser.
  {
    files: ['apps/*/vite.config.ts', 'apps/*/vitest.config.ts', 'apps/*/drizzle.config.ts'],
    languageOptions: { globals: globals.node },
  },

  // Integration tests assert on wire JSON. `inject().json()` is untyped by design, and that
  // is the point: the test checks what the server actually put on the wire, not what the
  // types promise. The contract itself is enforced by the response Zod schemas at runtime and
  // by the OpenAPI coverage test, so these rules would only add casts without adding safety.
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },

  // Root tooling configs: no type information available, Node globals.
  {
    files: ['*.js', '*.ts'],
    extends: [tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
  },

  prettier,
);
