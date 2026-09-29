import js from '@eslint/js';
import globals from 'globals';
export default [
  { ignores: ['node_modules/**', '_site/**', 'test-results/**', '.local/**', '.netlify/**'] },
  js.configs.recommended,
  { files: ['**/*.js', '**/*.mjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } }, rules: { 'no-unused-vars': ['error', { caughtErrors: 'none', argsIgnorePattern: '^_', ignoreRestSiblings: true }] } },
  { files: ['server/**/*.js', 'netlify/**/*.js', 'scripts/**/*.js', '.eleventy.js'], languageOptions: { sourceType: 'commonjs' } }
];
