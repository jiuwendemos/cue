import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base keeps the same build working on GitHub Pages (/cue/) and when
// the FastAPI server serves the SPA from the root of a production laptop.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 5174,
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
