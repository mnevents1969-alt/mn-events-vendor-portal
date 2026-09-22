import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Separate from vite.config.ts (which loads vite-plugin-pwa — irrelevant and slower for unit
// tests) but mirrors its path alias so `@/...` imports resolve the same way in tests as in the app.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"]
  }
});
