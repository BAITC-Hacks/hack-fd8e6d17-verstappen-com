import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  plugins: [react()],
  server: {
    // Фронт ходит на /api/..., Vite проксирует на FastAPI
    proxy: {
      "/api": process.env.API_URL ?? "http://localhost:8000",
    },
  },
});
