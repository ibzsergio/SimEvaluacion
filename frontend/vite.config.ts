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
