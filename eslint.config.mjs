import globals from 'globals'
import js from '@eslint/js'

export default [
  { ignores: ['node_modules/**'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-unused-vars': ['error', { args: 'all', argsIgnorePattern: '^_' }],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
]
