import preact from "@preact/preset-vite";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");
  const PORT = env.PORT || 3000;

  return {
    plugins: [
      preact(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: [
          "favicon.svg",
          "apple-touch-icon.png",
          "masked-icon.svg",
        ],
        manifest: {
          name: "WappFlow Scheduler",
          short_name: "WappFlow",
          description: "WhatsApp Message Scheduler with Playwright",
          theme_color: "#111b21",
          background_color: "#111b21",
          display: "standalone",
          icons: [
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "maskable-icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@shared": path.resolve(__dirname, "../shared"),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: `http://localhost:${PORT}`,
          changeOrigin: true,
          ws: true, // Enable WebSocket proxying
        },
      },
    },
  };
});
