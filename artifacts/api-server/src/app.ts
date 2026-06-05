import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { apiLimiter } from "./middleware/rateLimiter";
import { errorHandler } from "./middleware/errorHandler";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

// ── Security headers ────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// ── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : true;

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// ── Request logging ──────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── Global rate limiter ──────────────────────────────────────────────────────
app.use("/api", apiLimiter);

// ── Raw body (MUST come before express.json) ─────────────────────────────────
// Webhook routes that need HMAC verification receive a Buffer in req.body.
// Order matters: more-specific paths first.
app.use("/api/paymob/webhook", express.raw({ type: "application/json" }));
app.use("/api/webhooks/paymob", express.raw({ type: "application/json" }));
app.use("/api/webhooks", express.raw({ type: "application/json" }));
app.use("/api/bosta/status-webhook", express.raw({ type: "application/json" }));

// ── JSON / URL-encoded body parsers ──────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static assets ─────────────────────────────────────────────────────────────
const imagesDir = path.resolve(__dirname, "..", "public", "images");
app.use("/api/images", express.static(imagesDir, { maxAge: "7d" }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── Centralised error handler ─────────────────────────────────────────────────
app.use(errorHandler);

export default app;
