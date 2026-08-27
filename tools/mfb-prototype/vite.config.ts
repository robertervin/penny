import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/sms": {
        target: "http://localhost:3002",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sms$/, "/dev/sms"),
      },
      "/sms-health": {
        target: "http://localhost:3002",
        changeOrigin: true,
        rewrite: () => "/health",
      },
    },
  },
});
