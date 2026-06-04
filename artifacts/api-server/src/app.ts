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
// Routes under /api/webhooks and /api/bosta/status-webhook receive a Buffer in req.body.
// Note: /api/webhooks covers both /api/webhooks/orders-paid and /api/webhooks/paymob.
app.use("/api/webhooks", express.raw({ type: "application/json" }));
app.use("/api/bosta/status-webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve product images used in emails — resolved relative to dist/ at runtime
const imagesDir = path.resolve(__dirname, "..", "public", "images");
app.use("/api/images", express.static(imagesDir, { maxAge: "7d" }));

app.use("/api", router);

// Apple Pay domain verification — serves the domain association file required by Apple.
const applePayDomainAssociation = process.env["APPLE_PAY_DOMAIN_ASSOCIATION"];
if (applePayDomainAssociation) {
  app.get(
    "/.well-known/apple-developer-merchantid-domain-association",
    (_req, res) => {
      res.set("Content-Type", "application/octet-stream");
      res.send(Buffer.from(applePayDomainAssociation));
    },
  );
}

export default app;
