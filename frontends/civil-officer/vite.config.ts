import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
