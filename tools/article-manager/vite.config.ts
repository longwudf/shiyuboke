import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "tools/article-manager/client",
  plugins: [react()],
  server: {
    middlewareMode: true
  }
});
