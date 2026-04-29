import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ['class-variance-authority'],
  },

  // Tauri: prevent vite from obscuring Rust errors
  clearScreen: false,

  server: {
    port: 8080,
    strictPort: true, // Tauri needs a fixed port to connect to
    host: host || true,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 8081,
        }
      : undefined,
    watch: {
      // tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  build: {
    // Tauri supports es2021
    target: process.env.TAURI_ENV_PLATFORM == "windows"
      ? "chrome105"
      : "safari13",
    // don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
})