import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT ?? "5173";
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    ...(process.env.NODE_ENV !== "production" ? [runtimeErrorOverlay()] : []),
    {
      name: "non-blocking-css",
      transformIndexHtml: {
        enforce: "post" as const,
        handler(html: string) {
          return html.replace(
            /<link rel="stylesheet" crossorigin href="([^"]+\.css)">/g,
            (_match: string, href: string) =>
              `<link rel="preload" href="${href}" as="style" onload="this.onload=null;this.rel='stylesheet'">` +
              `<noscript><link rel="stylesheet" href="${href}"></noscript>`
          );
        },
      },
    },
    {
      name: "seo-headers",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && /\/images\/[^?]+\.(jpg|jpeg|webp|png|avif)(\?|$)/i.test(req.url)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            res.setHeader("Access-Control-Allow-Origin", "*");
          }
          if (req.url && !req.url.match(/\.(js|css|png|jpg|jpeg|webp|svg|ico|woff2?)(\?|$)/i)) {
            res.removeHeader("X-Robots-Tag");
            res.setHeader("X-Robots-Tag", "index, follow, max-image-preview:large");
          }
          if (req.url && (req.url === "/robots.txt" || req.url === "/sitemap.xml")) {
            res.removeHeader("X-Robots-Tag");
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/framer-motion")) return "framer-motion";
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) return "react-vendor";
          if (id.includes("node_modules/@shopify") || id.includes("node_modules/graphql")) return "shopify";
          if (id.includes("node_modules/sonner") || id.includes("node_modules/lucide-react")) return "ui-lib";
          if (id.includes("node_modules/fast-average-color")) return "fast-average-color";
          if (id.includes("node_modules/")) return "vendor";
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
