import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@mui/material": path.resolve(__dirname, "./src/mui"),
      "@mui/icons-material": path.resolve(__dirname, "./src/mui-icons"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3030",
        changeOrigin: true,
      },
      "/qr": {
        target: "http://localhost:3030",
        changeOrigin: true,
      },
    },
  },
});
