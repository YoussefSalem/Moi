import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

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
app.use(cors());

// Raw body must be captured BEFORE express.json() for webhook HMAC verification.
// Routes under /api/webhooks, /api/bosta/status-webhook, and /api/paymob/webhook receive a Buffer in req.body.
app.use("/api/webhooks", express.raw({ type: "application/json" }));
app.use("/api/bosta/status-webhook", express.raw({ type: "application/json" }));
app.use("/api/paymob/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve product images used in emails — resolved relative to dist/ at runtime
const imagesDir = path.resolve(__dirname, "..", "public", "images");
app.use("/api/images", express.static(imagesDir, { maxAge: "7d" }));

app.use("/api", router);

export default app;
