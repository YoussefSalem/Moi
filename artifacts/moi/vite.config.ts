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
    runtimeErrorOverlay(),
    {
      name: "seo-headers",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && /\/images\/[^?]+\.(jpg|jpeg|webp|png|avif)(\?|$)/i.test(req.url)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            res.setHeader("Access-Control-Allow-Origin", "*");
          }
          // Override any platform-injected noindex on HTML documents
          if (req.url && !req.url.match(/\.(js|css|png|jpg|jpeg|webp|svg|ico|woff2?)(\?|$)/i)) {
            res.removeHeader("X-Robots-Tag");
            res.setHeader("X-Robots-Tag", "index, follow, max-image-preview:large");
          }
          // Sitemap & robots must be served with plain text
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
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
