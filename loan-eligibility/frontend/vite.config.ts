import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Load environment variables (VITE_API_URL)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: { 
      port: 5173, 
      proxy: { 
        "/api": {
          target: env.VITE_API_URL || "http://127.0.0.1:5000",
          changeOrigin: true,
        }
      } 
    },
  };
});