import js from '@eslint/js'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'

export default [
	js.configs.recommended,
	{
		files: ['**/*.ts', '**/*.tsx'],
		languageOptions: {
			parser: typescriptParser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
				project: './tsconfig.json'
			},
			globals: {
				console: 'readonly',
				Buffer: 'readonly',
				URL: 'readonly',
				setTimeout: 'readonly',
				fetch: 'readonly',
				global: 'readonly',
				Thenable: 'readonly'
			}
		},
		plugins: {
			'@typescript-eslint': typescript
		},
		rules: {
			...typescript.configs.recommended.rules,
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': 'warn',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-var-requires': 'warn',
			'semi': ['error', 'always'],
			'quotes': ['error', 'double'],
			'no-useless-escape': 'warn',
			'no-case-declarations': 'warn',
			'require-yield': 'warn'
		}
	},
	{
		files: ['**/*.js'],
		languageOptions: {
			globals: {
				console: 'readonly',
				Buffer: 'readonly',
				URL: 'readonly',
				setTimeout: 'readonly',
				fetch: 'readonly',
				global: 'readonly',
				require: 'readonly',
				exports: 'readonly',
				module: 'readonly',
				__dirname: 'readonly',
				__filename: 'readonly',
				process: 'readonly'
			}
		},
		rules: {
			'no-unused-vars': 'warn',
			'semi': ['error', 'always'],
			'quotes': ['error', 'double'],
			'no-useless-escape': 'warn',
			'no-case-declarations': 'warn',
			'require-yield': 'warn',
			'no-undef': 'warn'
		}
	},
	{
		files: ['**/*.test.ts', '**/__tests__/**/*.ts', '**/__mocks__/**/*.ts'],
		languageOptions: {
			parser: typescriptParser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
				project: './tsconfig.json'
			},
			globals: {
				console: 'readonly',
				Buffer: 'readonly',
				URL: 'readonly',
				setTimeout: 'readonly',
				fetch: 'readonly',
				global: 'readonly',
				jest: 'readonly',
				describe: 'readonly',
				it: 'readonly',
				expect: 'readonly',
				beforeEach: 'readonly',
				afterEach: 'readonly',
				beforeAll: 'readonly',
				afterAll: 'readonly'
			}
		},
		plugins: {
			'@typescript-eslint': typescript
		},
		rules: {
			...typescript.configs.recommended.rules,
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-var-requires': 'warn',
			'semi': ['error', 'always'],
			'quotes': ['error', 'double'],
			'no-useless-escape': 'warn',
			'no-case-declarations': 'warn',
			'require-yield': 'warn'
		}
	}
]