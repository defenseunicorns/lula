import prettier from 'eslint-config-prettier';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default ts.config(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		ignores: [
			'**/*.yaml',
			'**/*.yml',
			'examples/**',
			'imported-controls/**',
			'control-test-results-*/**',
			'nist-*/**',
			'controls/**',
			'mappings/**',
			'build/**',
			'.svelte-kit/**',
			'dist/**'
		]
	},
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
			// Allow underscore-prefixed unused variables (intentionally unused parameters)
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_'
				}
			]
		}
	},
	{
		files: ['src/**/*.svelte', 'src/**/*.svelte.ts', 'src/**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		},
		rules: {
			// Svelte-specific rules
			'svelte/require-each-key': 'warn', // Downgrade to warning - keys are not always necessary
			'svelte/no-at-html-tags': 'warn', // Downgrade to warning - sometimes HTML is safe (from markdown)
			'svelte/prefer-svelte-reactivity': 'warn', // Downgrade to warning - sometimes Set is needed
			// Allow any types in Svelte components for now (will fix incrementally)
			'@typescript-eslint/no-explicit-any': 'warn'
		}
	}
);
