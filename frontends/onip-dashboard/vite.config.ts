import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    headers: {
      "Cache-Control": "no-store",
    },
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
    fs: {
      allow: [".."],
    },
  },
  preview: {
    headers: {
      "Cache-Control": "no-store",
    },
  },
  build: {
    target: "es2018",
  },
});
