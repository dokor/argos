import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Environnement node par défaut (tests lib/* purs). Les tests de composants
    // portent la directive `// @vitest-environment jsdom` en tête de fichier.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
