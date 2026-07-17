import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          // Compose-network hostname; local (non-Docker) dev sets
          // VITE_API_TARGET=http://localhost:8001 (e.g. in .env.local).
          target: env.VITE_API_TARGET || "http://server:8001",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
