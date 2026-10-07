import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        cacheId: "simeval-20261007-tk-padx",
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api/, /\/calendar\/file/, /\/assets\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/pyodide\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "simeval-pyodide",
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      includeAssets: ["favicon.svg", "icons.svg", "manifest.webmanifest", "manifest-docente.webmanifest"],
      manifest: {
        name: "SimEvaluación",
        short_name: "SimEval",
        description: "Seguimiento académico, avisos y calendario escolar",
        start_url: "/",
        scope: "/",
        theme_color: "#312e81",
        background_color: "#0f172a",
        display: "standalone",
        lang: "es",
        icons: [
          { src: "icons.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icons.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
