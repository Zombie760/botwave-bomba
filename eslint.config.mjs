import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules", "dist", "*.html", "api/*.json", "assets/**/*", "scripts/lib/dispatch.ts", "scripts/lib/dispatch.ts"] },
  {
    files: ["scripts/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parser: tseslint.parser,
      parserOptions: { project: true },
    },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-non-null-assertion": "off",
      "prefer-const": "warn",
      "no-var": "warn",
    },
  }
);
