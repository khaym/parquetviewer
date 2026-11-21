import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on 0.0.0.0 (accessible from Windows host)
  },
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "..", "shared"),
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        // Single JS file output (no code splitting for Webview)
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
});
