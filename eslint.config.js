import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Supabase query results and callback signatures make `any` hard to avoid
      // without extensive wrapper types — treat as warning, not error.
      "@typescript-eslint/no-explicit-any": "warn",
      // shadcn/ui generates empty interface extensions as a pattern; allow them.
      "@typescript-eslint/no-empty-object-type": "off",
      // CommonJS require() is used in tailwind.config.ts for plugins; allow it.
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
