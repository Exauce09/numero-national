import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    /** Formulaires Naissance / Décès : source unique dans le portail État civil. */
    alias: { "@ec": fileURLToPath(new URL("../etat-civil/src", import.meta.url)) },
    dedupe: ["react", "react-dom", "react-router-dom", "qrcode.react", "jsqr"],
  },
  server: {
    host: true,
    port: 5176,
    proxy: { "/api": "http://127.0.0.1:8000" },
    fs: { allow: [".."] },
    headers: {
      "Permissions-Policy": "geolocation=(self)",
      "Cache-Control": "no-store",
    },
  },
  build: { target: "es2018" },
});
