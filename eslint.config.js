import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import prettier from 'eslint-config-prettier';
import { includeIgnoreFile } from '@eslint/compat';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});
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
	},
	...compat
  .extends("eslint:recommended", "plugin:@typescript-eslint/recommended")
  .map((cfg) => ({
    ...cfg,
    files: ["**/*.ts"],
  })),
  {
	files: ["**/*.ts"],
    plugins: {
      "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: path.resolve(__dirname, "tsconfig.json"),
        tsconfigRootDir: path.resolve(__dirname, "./"),
        sourceType: "module",
      },
      globals: {
        ...globals.node,
      },
    },

    rules: {
      "@typescript-eslint/no-floating-promises": "warn",
      "class-methods-use-this": "warn",

      complexity: [
        "warn",
        {
          max: 15,
        },
      ],

      "consistent-this": "warn",
      eqeqeq: "error",

      "max-depth": [
        "warn",
        {
          max: 5,
        },
      ],

      "max-nested-callbacks": [
        "warn",
        {
          max: 5,
        },
      ],

      "max-params": [
        "error",
        {
          max: 5,
        },
      ],

      "max-statements": [
        "warn",
        {
          max: 20,
        },
        {
          ignoreTopLevelFunctions: true,
        },
      ],

      "no-invalid-this": "warn",
    },
  },

);
