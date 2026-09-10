import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** Force Edge / navigateurs à ne jamais garder d’anciens modules Vite. */
function noStoreAll(): Plugin {
  return {
    name: "onip-no-store",
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), noStoreAll()],
  server: {
    host: "0.0.0.0",
    port: 5183,
    strictPort: true,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
    fs: {
      allow: [".."],
    },
  },
  preview: {
    port: 5183,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  },
  build: {
    target: "es2018",
  },
});
