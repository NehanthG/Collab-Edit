import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: ".", // keep root
  plugins: [react()],
  optimizeDeps: {
    include: ["socket.io-client"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: "/index.html",
    },
  },
});
