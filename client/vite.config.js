import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const devProxyTarget = process.env.VITE_DEV_PROXY_TARGET || "http://localhost:3001";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "inline",
      includeAssets: ["favicon.svg", "logo.svg", "logo_lt.svg", "avatar.svg", "thumbnail_ba.svg"],
      manifest: {
        name: "Pinewood | Keep the way",
        short_name: "Pinewood",
        description:
          "Tracciati, navigazione sul sentiero e percorsi per camminare con Pinewood.",
        id: "/",
        lang: "it",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        categories: ["lifestyle", "health", "fitness"],
        icons: [
          {
            src: "logo_lt.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "logo_lt.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "pinewood-osm-tiles",
              expiration: {
                maxEntries: 220,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    watch: { usePolling: true },
    allowedHosts: [".ts.net", "caplav61969.tailed44b5.ts.net"],
    proxy: {
      "/api": {
        target: devProxyTarget,
        changeOrigin: true,
      },
      "/uploads": {
        target: devProxyTarget,
        changeOrigin: true,
      },
    },
  },
});
