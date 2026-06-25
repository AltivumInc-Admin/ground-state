import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import react from 'eslint-plugin-react'

// Flat config. Deliberately scoped: JS recommended + react-hooks, plus tuned
// no-unused-vars. We do NOT enable eslint-plugin-react's recommended set —
// react/no-unknown-property floods false positives on the R3F three.js JSX
// (<bufferGeometry args=…>, attach, position, …), which are valid here.
export default [
  {
    ignores: [
      'dist/**',
      'dist-ssr/**',
      'node_modules/**',
      '.ds-sync/**',
      'ds-bundle/**',
      '.design-sync/**',
      'backend/**/.aws-sam/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks, react },
    rules: {
      // Counts identifiers referenced only in JSX (<Fx>, <Canvas>, …) as used,
      // so no-unused-vars doesn't flag component imports. NOT the full react
      // recommended set (that flags valid R3F three.js props).
      'react/jsx-uses-vars': 'error',
      'react-hooks/rules-of-hooks': 'error',
      // Tree is clean (the module-scope env consts in Welcome/Confirm are exempt),
      // so this is a hard error: an effect that omits a real dependency blocks the gate.
      'react-hooks/exhaustive-deps': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]
