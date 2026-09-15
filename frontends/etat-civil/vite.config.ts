import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Port dédié — distinct du portail civil-officer (5176). */
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5180,
    proxy: { "/api": "http://127.0.0.1:8000" },
    fs: { allow: [".."] },
    headers: {
      "Permissions-Policy": "geolocation=(self)",
      "Cache-Control": "no-store",
    },
  },
  build: { target: "es2018" },
});
