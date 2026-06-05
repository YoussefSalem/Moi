import type { ErrorRequestHandler } from "express";
import { logger } from "../lib/logger";

/**
 * Centralised Express error-handling middleware.
 * Must have 4 parameters so Express treats it as an error handler.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const status: number =
    typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;

  const message: string =
    status < 500
      ? String((err as { message?: unknown }).message ?? "Bad request")
      : "Internal server error";

  logger.error(
    { err, method: req.method, url: req.url, status },
    "Unhandled error",
  );

  res.status(status).json({ error: message });
};
