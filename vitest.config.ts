import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

// The aliases below mirror vite.config.ts deliberately. Without the mirror any
// "@/…" import resolves as a bare package name and the whole suite fails to
// load rather than failing a test — a confusing five minutes the first time.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./supabase/functions/_shared", import.meta.url)),
    },
  },
  test: {
    // node, not jsdom, is the default: the diagnostic core is pure logic and
    // neither needs a DOM nor should pay a second of jsdom startup for one.
    // Component tests opt in with a `@vitest-environment jsdom` docblock.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "supabase/functions/**/*.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
