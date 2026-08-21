import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // A leading underscore marks a parameter that exists to give a spy its
      // signature, or to skip an argument. Without this the only ways to type
      // such a spy are an `any` cast or a disable comment, both worse.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // The Edge Function is Deno, not browser: it reads Deno.env and serves HTTP.
  // Type-checking it properly needs Deno's own tooling, which the browser
  // typecheck deliberately does not cover — see docs/ARCHITECTURE_ASSESSMENT.md.
  { files: ["supabase/functions/*/index.ts"], languageOptions: { globals: { Deno: "readonly" } } },
);
