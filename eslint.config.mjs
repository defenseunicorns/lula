import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import jsdocPlugin from "eslint-plugin-jsdoc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: ["**/node_modules", "**/dist"],
  },
  ...compat.extends("eslint:recommended", "plugin:@typescript-eslint/recommended"),
  {
    plugins: {
      jsdoc: jsdocPlugin,
    },
    rules: {
      ...jsdocPlugin.configs["recommended-typescript"].rules,
    },
  },
  {
    plugins: {
      "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
      globals: {
        ...Object.fromEntries(Object.entries(globals.browser).map(([key]) => [key, "off"])),
      },

      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "script",

      parserOptions: {
        project: ["tsconfig.json"],
      },
    },

    rules: {
      "@typescript-eslint/no-floating-promises": "warn",
      "class-methods-use-this": "warn",
      complexity: [
        "warn",
        {
          max: 10,
        },
      ],
      "consistent-this": "warn",
      eqeqeq: "error",
      "max-depth": [
        "warn",
        {
          max: 3,
        },
      ],
      "max-nested-callbacks": [
        "warn",
        {
          max: 4,
        },
      ],
      "max-params": [
        "warn",
        {
          max: 4,
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
      "class-methods-use-this": "warn",
      "consistent-this": "warn",
      "no-invalid-this": "warn",
      "@typescript-eslint/no-floating-promises": [
        "warn",
        {
          ignoreVoid: true,
        },
      ],

      "jsdoc/tag-lines": [
        "error",
        "any",
        {
          startLines: 1,
        },
      ],
    },
  },
  {
    files: ["**/*.test.ts"],

    rules: {
      "max-nested-callbacks": [
        "warn",
        {
          max: 8,
        },
      ],
    },
  },
];
