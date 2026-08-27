import react from "@vitejs/plugin-react";
import {
  defineConfig
} from "vite";

const controlPlane =
  "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [
    react()
  ],
  server: {
    port: 5173,
    proxy: {
      "/api":
        controlPlane,
      "/auth":
        controlPlane,
      "/live":
        controlPlane,
      "/ready":
        controlPlane
    }
  }
});
